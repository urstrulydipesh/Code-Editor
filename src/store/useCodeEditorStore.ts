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

        const requestBody = {
          language_id: parseInt(language_id.toString()),
          source_code: btoa(code), // Convert to base64
          stdin: "",
        };

        console.log("Sending to Judge0:", requestBody);

        const response = await fetch(
          "https://ce.judge0.com/submissions?base64_encoded=true&wait=true",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );

        console.log("Judge0 status:", response.status);
        console.log("Judge0 headers:", {
          contentType: response.headers.get("content-type"),
          contentLength: response.headers.get("content-length"),
        });

        let data;
        const text = await response.text();
        console.log("Judge0 raw response:", text);

        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error("Failed to parse Judge0 response:", parseError);
          throw new Error(`Judge0 returned invalid JSON: ${text}`);
        }

        console.log("Judge0 response:", data);

        // Handle error responses
        if (!response.ok || response.status !== 200) {
          const errorMsg = data.message || data.error || `HTTP ${response.status}: ${text.slice(0, 200)}`;
          console.error("Judge0 Error Response:", {
            status: response.status,
            statusText: response.statusText,
            error: errorMsg,
            data: data
          });
          set({
            error: `Code execution failed: ${errorMsg}`,
            executionResult: { code, output: "", error: errorMsg },
          });
          return;
        }

        // Decode base64 fields from Judge0 response
        const decodeBase64 = (str: string | null | undefined) => {
          if (!str) return "";
          try {
            return atob(str);
          } catch (e) {
            return str;
          }
        };

        const decodedStdout = decodeBase64(data.stdout);
        const decodedStderr = decodeBase64(data.stderr);
        const decodedCompileOutput = decodeBase64(data.compile_output);

        console.log("Decoded output:", { decodedStdout, decodedStderr, decodedCompileOutput });

        if (decodedStderr) {
          set({
            error: decodedStderr,
            executionResult: { code, output: "", error: decodedStderr },
          });
          return;
        }

        if (decodedCompileOutput) {
          set({
            error: decodedCompileOutput,
            executionResult: { code, output: "", error: decodedCompileOutput },
          });
          return;
        }

        set({
          output: decodedStdout.trim(),
          error: null,
          executionResult: {
            code,
            output: decodedStdout.trim(),
            error: null,
          },
        });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("Exception running code:", errorMsg, error);
        set({
          error: `Error: ${errorMsg}`,
          executionResult: { code, output: "", error: errorMsg },
        });
      } finally {
        set({ isRunning: false });
      }
    },
  };
});

export const getExecutionResult = () => useCodeEditorStore.getState().executionResult;