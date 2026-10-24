import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "../components/Icon";
import { TAB_BAR_HEIGHT, colors, relativeTime } from "../theme";
import { useDuet } from "../store";

const STATUS_META = {
  needs_approval: { icon: "alert-circle", color: colors.accent, label: "Needs your approval" },
  running: { icon: "loader", color: colors.doc, label: "Running" },
  queued: { icon: "clock", color: colors.textDim, label: "Queued" },
  done: { icon: "check-circle", color: colors.success, label: "Done" },
  declined: { icon: "x-circle", color: colors.textFaint, label: "Declined" },
};

const ORDER = ["needs_approval", "running", "queued", "done", "declined"];

function TaskCard({ task, channel, onApprove, onDecline }) {
  const meta = STATUS_META[task.status] || STATUS_META.queued;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {task.status === "running" ? <ActivityIndicator size="small" color={meta.color} /> : <Icon name={meta.icon} size={20} color={meta.color} />}
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.title}>{task.title}</Text>
          {task.details ? <Text style={styles.details}>{task.details}</Text> : null}
          <View style={styles.metaRow}>
            {channel ? (
              <>
                <Icon name={channel.icon || "hash"} size={11} color={colors.textFaint} />
                <Text style={styles.meta}>#{channel.name}</Text>
                <Text style={styles.meta}>·</Text>
              </>
            ) : null}
            <Text style={styles.meta}>{relativeTime(task.createdAt)}</Text>
          </View>
        </View>
      </View>
      {task.status === "running" ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round((task.progress || 0.08) * 100)}%` }]} />
        </View>
      ) : null}
      {task.status === "needs_approval" ? (
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => onDecline(task.id)} style={[styles.btn, styles.btnGhost]}>
            <Text style={styles.btnGhostText}>Decline</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onApprove(task.id)} style={[styles.btn, styles.btnPrimary]}>
            <Text style={styles.btnPrimaryText}>Approve</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function TasksScreen() {
  const { state, resolveTask } = useDuet();
  const channelOf = (id) => state.channels.find((c) => c.id === id);
  const groups = ORDER.map((status) => ({ status, items: state.tasks.filter((t) => t.status === status) })).filter((g) => g.items.length);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Tasks</Text>
      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="check-square" size={30} color={colors.textFaint} />
          <Text style={styles.emptyText}>No tasks yet. Ask Claude Duet to take something on and it will show up here.</Text>
        </View>
      ) : null}
      {groups.map((group) => (
        <View key={group.status} style={{ gap: 10 }}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{STATUS_META[group.status].label}</Text>
            <Text style={styles.count}>{group.items.length}</Text>
          </View>
          {group.items.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              channel={task.channel ? channelOf(task.channel) : null}
              onApprove={(id) => resolveTask(id, true)}
              onDecline={(id) => resolveTask(id, false)}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: TAB_BAR_HEIGHT + 40, gap: 20 },
  screenTitle: { color: colors.text, fontSize: 26, fontWeight: "700" },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 13.5, fontWeight: "600" },
  count: { color: colors.textFaint, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { color: colors.text, fontSize: 15, fontWeight: "600", lineHeight: 20 },
  details: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  meta: { color: colors.textFaint, fontSize: 11.5 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh, overflow: "hidden" },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  actions: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnGhost: { backgroundColor: colors.surfaceHigh },
  btnGhostText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  empty: { alignItems: "center", gap: 12, paddingTop: 60, paddingHorizontal: 30 },
  emptyText: { color: colors.textDim, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
