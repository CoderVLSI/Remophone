import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EVERYTHING, emptyState, makeSeed } from "./seed";
import { DEFAULT_SETTINGS } from "./gemini/config";
import { generateArtifact, runAgent, transcribeAudio } from "./gemini/rest";
import { executeTool } from "./gemini/tools";
import { buildSystemInstruction } from "./gemini/prompts";
import { createVoiceController } from "./voice";
import { createDictation } from "./audio/dictation";
import { getSecret, setSecret } from "./secret";

const STATE_KEY = "duet.state.v1";
const SETTINGS_KEY = "duet.settings.v1";
const MAX_MESSAGES = 200;

const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function reducer(state, action) {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "addMessage":
      return { ...state, messages: [...state.messages, action.message].slice(-MAX_MESSAGES) };
    case "addChannel":
      return { ...state, channels: [...state.channels, action.channel] };
    case "addTask":
      return { ...state, tasks: [action.task, ...state.tasks] };
    case "updateTask":
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) };
    case "addArtifact":
      return { ...state, artifacts: [action.artifact, ...state.artifacts] };
    case "updateArtifact":
      return {
        ...state,
        artifacts: state.artifacts.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      };
    case "deleteArtifact":
      return { ...state, artifacts: state.artifacts.filter((a) => a.id !== action.id) };
    default:
      return state;
  }
}

const DuetContext = createContext(null);
export const useDuet = () => useContext(DuetContext);

export function DuetProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, null, emptyState);
  const stateRef = useRef(state);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modelNotice, setModelNotice] = useState(null);
  const busyRef = useRef(false);
  const routedRef = useRef(null);
  const [voice, setVoice] = useState({ status: "idle", level: 0, muted: false, error: null, userText: "", assistantText: "" });
  const voiceChannelRef = useRef(null);
  const [dictationState, setDictationState] = useState("idle");
  const dictationRef = useRef(null);

  // Apply the reducer eagerly so tool calls in the same tick see up-to-date state.
  const dispatch = useCallback((action) => {
    stateRef.current = reducer(stateRef.current, action);
    rawDispatch(action);
  }, []);

  // ----- persistence -----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loadedState = null;
      let loadedSettings = {};
      try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        if (raw) loadedState = JSON.parse(raw);
        const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);
        if (rawSettings) loadedSettings = JSON.parse(rawSettings);
      } catch {
        // fall through to the demo workspace
      }
      const apiKey = (await getSecret()) || process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
      if (cancelled) return;
      const merged = { ...DEFAULT_SETTINGS, ...loadedSettings, apiKey };
      settingsRef.current = merged;
      setSettings(merged);
      dispatch({ type: "hydrate", state: loadedState || makeSeed() });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(STATE_KEY, JSON.stringify(state)).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [state, hydrated]);

  const updateSettings = useCallback(async (patch) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    const { apiKey, ...rest } = next;
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
    } catch {
      // ignore
    }
    if ("apiKey" in patch) await setSecret(apiKey);
  }, []);

  // ----- basic actions -----
  const addMessage = useCallback(
    (message) => {
      const full = { id: newId("m"), ts: Date.now(), ...message };
      dispatch({ type: "addMessage", message: full });
      return full.id;
    },
    [dispatch],
  );

  const addTask = useCallback(
    (task) => {
      const id = newId("t");
      dispatch({ type: "addTask", task: { id, progress: 0, createdAt: Date.now(), ...task } });
      return id;
    },
    [dispatch],
  );

  const updateTask = useCallback((id, patch) => dispatch({ type: "updateTask", id, patch }), [dispatch]);

  const addChannel = useCallback(
    ({ name, description, icon }) => {
      const clean = String(name || "").trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-");
      if (!clean) return null;
      const existing = stateRef.current.channels.find((c) => c.name === clean);
      if (existing) return existing.id;
      const id = newId("ch");
      dispatch({ type: "addChannel", channel: { id, name: clean, description: description || "", icon: icon || "hash" } });
      return id;
    },
    [dispatch],
  );

  const togglePin = useCallback(
    (id) => {
      const artifact = stateRef.current.artifacts.find((a) => a.id === id);
      if (artifact) dispatch({ type: "updateArtifact", id, patch: { pinned: !artifact.pinned } });
    },
    [dispatch],
  );

  const updateArtifactContent = useCallback(
    (id, content) => dispatch({ type: "updateArtifact", id, patch: { content, updatedAt: Date.now() } }),
    [dispatch],
  );

  const deleteArtifact = useCallback((id) => dispatch({ type: "deleteArtifact", id }), [dispatch]);

  const resolveTask = useCallback(
    (id, approved) => {
      const task = stateRef.current.tasks.find((t) => t.id === id);
      if (!task) return;
      updateTask(id, {
        status: approved ? "done" : "declined",
        progress: approved ? 1 : task.progress,
        details: `${task.details ? `${task.details} ` : ""}${approved ? "Approved by you." : "Declined by you."}`,
      });
    },
    [updateTask],
  );

  // ----- Make tab generation -----
  const createArtifact = useCallback(
    async ({ kind, title, brief, channel }) => {
      const id = newId("a");
      const now = Date.now();
      dispatch({
        type: "addArtifact",
        artifact: { id, kind, title, channel: channel || null, pinned: false, status: "generating", createdAt: now, updatedAt: now, content: null },
      });
      try {
        const content = await generateArtifact({ settings: settingsRef.current, kind, title, brief });
        dispatch({
          type: "updateArtifact",
          id,
          patch: { status: "ready", content, title: content.title || title, updatedAt: Date.now() },
        });
        const count = content.slides?.length ?? content.sections?.length ?? content.frames?.length ?? 0;
        return { ok: true, artifact_id: id, title: content.title || title, items: count };
      } catch (error) {
        dispatch({ type: "updateArtifact", id, patch: { status: "error", error: error.message } });
        return { error: error.message || String(error), artifact_id: id };
      }
    },
    [dispatch],
  );

  const editArtifact = useCallback(
    async (id, instruction) => {
      const artifact = stateRef.current.artifacts.find((a) => a.id === id);
      if (!artifact) return { error: `No file with id ${id}` };
      if (artifact.status === "generating" || artifact.editing) return { error: "That file is already being worked on." };
      dispatch({ type: "updateArtifact", id, patch: { editing: true } });
      try {
        const content = await generateArtifact({
          settings: settingsRef.current,
          kind: artifact.kind,
          title: artifact.title,
          existing: artifact.content,
          instruction,
        });
        dispatch({
          type: "updateArtifact",
          id,
          patch: { content, title: content.title || artifact.title, updatedAt: Date.now(), editing: false, status: "ready" },
        });
        return { ok: true, artifact_id: id };
      } catch (error) {
        dispatch({ type: "updateArtifact", id, patch: { editing: false } });
        return { error: error.message || String(error) };
      }
    },
    [dispatch],
  );

  const toolContext = useMemo(
    () => ({
      getState: () => stateRef.current,
      addMessage,
      addTask,
      updateTask,
      createArtifact,
      editArtifact,
      noteRoutedChannel: (id) => {
        routedRef.current = id;
      },
    }),
    [addMessage, addTask, updateTask, createArtifact, editArtifact],
  );

  // ----- chat -----
  const sendMessage = useCallback(
    async (text, channelId) => {
      const trimmed = String(text || "").trim();
      if (!trimmed || busyRef.current) return;
      const channel = channelId && channelId !== EVERYTHING ? channelId : null;
      busyRef.current = true;
      setBusy(true);
      routedRef.current = null;
      setModelNotice(null);
      addMessage({ role: "user", text: trimmed, channel });
      try {
        const history = stateRef.current.messages.slice(-24).map((m) => ({ role: m.role, text: m.text }));
        const { text: reply, model, fellBack } = await runAgent({
          settings: settingsRef.current,
          history,
          systemInstruction: buildSystemInstruction(stateRef.current, { userName: settingsRef.current.userName }),
          executeTool: (name, args) => executeTool(name, args, toolContext),
        });
        if (fellBack) setModelNotice(`${settingsRef.current.chatModel} wasn't available, so ${model} answered.`);
        addMessage({ role: "assistant", text: reply || "Done.", channel: routedRef.current || channel });
      } catch (error) {
        addMessage({ role: "assistant", text: error.message || String(error), error: true, channel });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [addMessage, toolContext],
  );

  // ----- voice (Gemini Live) -----
  // Every dependency below is a stable callback or ref, so the controller is created once.
  const voiceRef = useRef(null);
  if (!voiceRef.current) {
    voiceRef.current = createVoiceController({
      getSettings: () => settingsRef.current,
      getState: () => stateRef.current,
      toolContext,
      addMessage: (role, text) => addMessage({ role, text, channel: voiceChannelRef.current }),
      onChange: setVoice,
    });
  }

  const startVoice = useCallback((channelId) => {
    voiceChannelRef.current = channelId && channelId !== EVERYTHING ? channelId : null;
    return voiceRef.current.start();
  }, []);
  const stopVoice = useCallback(() => voiceRef.current.stop(), []);
  const setVoiceMuted = useCallback((muted) => voiceRef.current.setMuted(muted), []);

  // ----- dictation (record, then Gemini transcribes) -----
  const startDictation = useCallback(async () => {
    if (dictationState !== "idle") return { error: null };
    const dictation = createDictation();
    if (!dictation.supported) return { error: "Dictation isn't available on this device." };
    try {
      await dictation.start();
      dictationRef.current = dictation;
      setDictationState("recording");
      return { error: null };
    } catch (error) {
      return { error: error.message || String(error) };
    }
  }, [dictationState]);

  const finishDictation = useCallback(async () => {
    const dictation = dictationRef.current;
    if (!dictation) return { text: "", error: null };
    dictationRef.current = null;
    setDictationState("transcribing");
    try {
      const clip = await dictation.stop();
      if (!clip) return { text: "", error: null };
      const text = await transcribeAudio({ settings: settingsRef.current, ...clip });
      return { text, error: null };
    } catch (error) {
      return { text: "", error: error.message || String(error) };
    } finally {
      setDictationState("idle");
    }
  }, []);

  const cancelDictation = useCallback(async () => {
    await dictationRef.current?.cancel();
    dictationRef.current = null;
    setDictationState("idle");
  }, []);

  // ----- data management -----
  const resetDemo = useCallback(() => dispatch({ type: "hydrate", state: makeSeed() }), [dispatch]);
  const clearAll = useCallback(() => dispatch({ type: "hydrate", state: emptyState() }), [dispatch]);

  const value = useMemo(
    () => ({
      state,
      settings,
      hydrated,
      busy,
      modelNotice,
      voice,
      dictationState,
      updateSettings,
      sendMessage,
      addChannel,
      addTask,
      togglePin,
      updateArtifactContent,
      deleteArtifact,
      resolveTask,
      createArtifact,
      editArtifact,
      startVoice,
      stopVoice,
      setVoiceMuted,
      startDictation,
      finishDictation,
      cancelDictation,
      resetDemo,
      clearAll,
    }),
    [
      state, settings, hydrated, busy, modelNotice, voice, dictationState, updateSettings, sendMessage, addChannel, addTask,
      togglePin, updateArtifactContent, deleteArtifact, resolveTask, createArtifact, editArtifact, startVoice,
      stopVoice, setVoiceMuted, startDictation, finishDictation, cancelDictation, resetDemo, clearAll,
    ],
  );

  return <DuetContext.Provider value={value}>{children}</DuetContext.Provider>;
}
