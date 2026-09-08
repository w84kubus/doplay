"use client";
import dynamic from "next/dynamic";
import { LoaderCircle } from "lucide-react";
import type { ComponentType } from "react";
import type { GameHostViewProps, GameSettingsProps, GameViewProps } from "./view";

// Dynamiczne importy gier (UPGRADE.md §E1). Każda gra w osobnym chunku —
// gracz pobiera tylko kod aktualnej gry, nie wszystkich pięciu naraz.
export interface GameComponents {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Settings: ComponentType<GameSettingsProps<any>>;
  PlayerView: ComponentType<GameViewProps>;
  HostView: ComponentType<GameHostViewProps>;
}

const Loading = () => (
  <div className="flex flex-1 items-center justify-center p-8">
    <LoaderCircle size={32} strokeWidth={2.5} className="animate-spin text-mint" aria-label="Ładowanie gry" />
  </div>
);

export const GAME_COMPONENTS: Record<string, GameComponents> = {
  stoper: {
    Settings: dynamic(() => import("./stoper/Settings").then((m) => m.StoperSettingsPanel)),
    PlayerView: dynamic(() => import("./stoper/PlayerView").then((m) => m.StoperPlayerView), { loading: Loading }),
    HostView: dynamic(() => import("./stoper/HostView").then((m) => m.StoperHostView), { loading: Loading }),
  },
  "panstwa-miasta": {
    Settings: dynamic(() => import("./panstwa-miasta/Settings").then((m) => m.PmSettingsPanel)),
    PlayerView: dynamic(() => import("./panstwa-miasta/PlayerView").then((m) => m.PmPlayerView), { loading: Loading }),
    HostView: dynamic(() => import("./panstwa-miasta/HostView").then((m) => m.PmHostView), { loading: Loading }),
  },
  wisielec: {
    Settings: dynamic(() => import("./wisielec/Settings").then((m) => m.WisielecSettingsPanel)),
    PlayerView: dynamic(() => import("./wisielec/PlayerView").then((m) => m.WisielecPlayerView), { loading: Loading }),
    HostView: dynamic(() => import("./wisielec/HostView").then((m) => m.WisielecHostView), { loading: Loading }),
  },
  impostor: {
    Settings: dynamic(() => import("./impostor/Settings").then((m) => m.ImpostorSettingsPanel)),
    PlayerView: dynamic(() => import("./impostor/PlayerView").then((m) => m.ImpostorPlayerView), { loading: Loading }),
    HostView: dynamic(() => import("./impostor/HostView").then((m) => m.ImpostorHostView), { loading: Loading }),
  },
  odcien: {
    Settings: dynamic(() => import("./odcien/Settings").then((m) => m.OdcienSettingsPanel)),
    PlayerView: dynamic(() => import("./odcien/PlayerView").then((m) => m.OdcienPlayerView), { loading: Loading }),
    HostView: dynamic(() => import("./odcien/HostView").then((m) => m.OdcienHostView), { loading: Loading }),
  },
  kolko: {
    Settings: dynamic(() => import("./kolko/Settings").then((m) => m.KolkoSettingsPanel)),
    PlayerView: dynamic(() => import("./kolko/PlayerView").then((m) => m.KolkoPlayerView), { loading: Loading }),
    HostView: dynamic(() => import("./kolko/HostView").then((m) => m.KolkoHostView), { loading: Loading }),
  },
  kasyno: {
    Settings: dynamic(() => import("./kasyno/Settings").then((m) => m.KasynoSettingsPanel)),
    PlayerView: dynamic(() => import("./kasyno/PlayerView").then((m) => m.KasynoPlayerView), { loading: Loading }),
    HostView: dynamic(() => import("./kasyno/HostView").then((m) => m.KasynoHostView), { loading: Loading }),
  },
  chinczyk: {
    Settings: dynamic(() => import("./chinczyk/Settings").then((m) => m.ChinczykSettingsPanel)),
    PlayerView: dynamic(() => import("./chinczyk/PlayerView").then((m) => m.ChinczykPlayerView), { loading: Loading }),
    HostView: dynamic(() => import("./chinczyk/HostView").then((m) => m.ChinczykHostView), { loading: Loading }),
  },
  mafia: {
    Settings: dynamic(() => import("./mafia/Settings").then((m) => m.MafiaSettingsPanel)),
    PlayerView: dynamic(() => import("./mafia/PlayerView").then((m) => m.MafiaPlayerView), { loading: Loading }),
    HostView: dynamic(() => import("./mafia/HostView").then((m) => m.MafiaHostView), { loading: Loading }),
  },
};
