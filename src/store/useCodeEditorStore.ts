import { CodeEditorState } from "./../types/index";
import { create } from "zustand";
import { Monaco } from "@monaco-editor/react";

const getInitialState = () => {
  if (typeof window === "undefined") {
    return {
      language: "javascript",
      fontSize: 16,
      theme: "vs-dark",
    };
  }

  const savedLanguage = localStorage.getItem("editor-language") || "javascript";
  const savedTheme = localStorage.getItem("editor-theme") || "vs-dark";
  const savedFontSize = localStorage.getItem("editor-font-size") || 16;

  return {
    language: savedLanguage,
    theme: savedTheme,
    fontSize: Number(savedFontSize),
  };
};

export const useCodeEditorStore = create<CodeEditorState>((set, get) => {
  const initialState = getInitialState();

  return {
    ...initialState,
    output: "",
    isRunning: false,
    error: null,
    editor: null,
    executionResult: null,

    getCode: () => get().editor?.getValue() || "",

    setEditor: (editor: Monaco) => {
      const savedCode = localStorage.getItem(`editor-code-${get().language}`);
      if (savedCode) editor.setValue(savedCode);

      set({ editor });
    },

    setTheme: (theme: string) => {
      localStorage.setItem("editor-theme", theme);
      set({ theme });
    },

    setFontSize: (fontSize: number) => {
      localStorage.setItem("editor-font-size", fontSize.toString());
      set({ fontSize });
    },

    setLanguage: (language: string) => {
      const currentCode = get().editor?.getValue();

      if (currentCode) {
        localStorage.setItem(`editor-code-${get().language}`, currentCode);
      }

      localStorage.setItem("editor-language", language);

      set({
        language,
        output: "",
        error: null,
      });
    },

    runCode: async () => {
      const { language, getCode } = get();
      const code = getCode();

      if (!code) {
        set({ error: "Please enter some code" });
        return;
      }

      set({ isRunning: true, error: null, output: "" });

      try {
        const languageMap: Record<string, number> = {
          javascript: 63,
          typescript: 74,
          python: 71,
          java: 62,
          cpp: 54,
          go: 60,
          rust: 73,
          ruby: 72,
          csharp: 51,
          swift: 83
        };

        const language_id = languageMap[language];

        if (!language_id) {
          set({ error: "Language not supported for execution" });
          return;
        }

        const response = await fetch(
          "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              language_id,
              source_code: code,
            }),
          }
        );

        const data = await response.json();

        console.log("Judge0 response:", data);

        if (data.stderr) {
          set({
            error: data.stderr,
            executionResult: { code, output: "", error: data.stderr },
          });
          return;
        }

        if (data.compile_output) {
          set({
            error: data.compile_output,
            executionResult: { code, output: "", error: data.compile_output },
          });
          return;
        }

        const output = data.stdout || "";

        set({
          output: output.trim(),
          error: null,
          executionResult: {
            code,
            output: output.trim(),
            error: null,
          },
        });

      } catch (error) {
        console.log("Error running code:", error);
        set({
          error: "Error running code",
          executionResult: { code, output: "", error: "Error running code" },
        });
      } finally {
        set({ isRunning: false });
      }
    },
  };
});

export const getExecutionResult = () => useCodeEditorStore.getState().executionResult;