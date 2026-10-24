import React from "react";
import DuetApp from "./src/duet/DuetApp";
import RemoPhoneApp from "./src/RemoPhoneApp";

// The Claude Duet clone is the default screen. Set EXPO_PUBLIC_APP=remophone to run the
// original RemoPhone relay/remote-control prototype instead.
export default function App() {
  return process.env.EXPO_PUBLIC_APP === "remophone" ? <RemoPhoneApp /> : <DuetApp />;
}
