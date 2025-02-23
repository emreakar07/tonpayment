declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        MainButton: {
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
        };
        sendData: (data: string) => void;
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
  }
}

export {}; 