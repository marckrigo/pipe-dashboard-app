export type LoggedUser = {
  name: string;
  avatarUrl: string;
};

type PipefyCard = {
  id: string;
  title: string;
};

export type PipefyAppInstance = {
  app: { pipeId?: string };
  card(): Promise<PipefyCard>;
  query<T>(query: string, variables?: Record<string, unknown>): Promise<{ data: T }>;
  render(callback: () => void): void;
};

type PipefyAppAction = {
  sidebar(options: { title: string; url: string }): void;
  dropdown(options: { title: string; items: Array<{ title: string; callback: () => void }> }): void;
  modal(options: { url: string; height?: string; width?: string }): void;
  closeCard(): void;
};

type PipefyAppFeatures = {
  'card-tab'?: () => {
    title: string;
    icon: string;
    url: string;
    buttons?: unknown[];
  };
  'pipe-buttons'?: () => Array<{
    text: string;
    callback: (action: PipefyAppAction) => void;
  }>;
  'pipe-view'?: () => { icon: string; text: string; url: string };
  'card-buttons'?: () => Array<{
    icon: string;
    text: string;
    callback: (action: PipefyAppAction) => void;
  }>;
};

export type PipefyApp = {
  init(): PipefyAppInstance;
  initCall(features: PipefyAppFeatures): void;
  render(callback: () => void): void;
  resizeTo(selector: string): void;
};

declare global {
  interface Window {
    PipefyApp?: PipefyApp;
  }
}
