import { Plugin } from "obsidian";

export default class MyPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor(
      "md-query",
      async (source, el, ctx) => {
        // Parts is an array of key value pairs of the query.
        const parts = source.split("\n");
        const partsMap = new Map<string, string>();
        parts.forEach((part) => {
          const [key, value] = part.split(":").map((str) => str.trim());
          if (key && value) {
            partsMap.set(key, value);
          }
        });
        const headingText = partsMap.get("heading");
        const headingLevel = partsMap.get("level");
        const prefix = partsMap.get("path");

        if (!headingText) {
          throw new Error("Missing 'heading' value in the query.");
        }
        if (!headingLevel) {
          throw new Error("Missing 'level' value in the query.");
        }
        if (!prefix) {
          throw new Error("Missing 'prefix' value in the query.");
        }
        let endResult: Array<{ lines: string[]; file: string }> = [];

        const files = this.app.vault.getMarkdownFiles();

        for (const file of files) {
          if (!file.path.startsWith(prefix)) continue;

          const content = await this.app.vault.read(file);
          const lines = content.split("\n");

          let result: string[] = [];

          for (let i = 0; i < lines.length; ) {
            const line = lines[i];
            const headingMatch =
              line.startsWith("#".repeat(parseInt(headingLevel))) &&
              line.includes(headingText);
            if (!headingMatch) {
              i++;
              continue;
            }
            let nextHeadingIndex = lines.slice(i + 1).findIndex((l) => {
              let currentLevel = 0;
              for (const char of l) {
                if (char === "#") {
                  currentLevel++;
                } else {
                  break;
                }
              }
              return currentLevel > 0 && currentLevel <= parseInt(headingLevel);
            });
            if (nextHeadingIndex === -1) {
              nextHeadingIndex = lines.length;
            } else {
              nextHeadingIndex += i + 1;
            }
            result = result.concat(lines.slice(i, nextHeadingIndex));
            i = nextHeadingIndex;
          }

          if (result.length > 0) {
            endResult.push({ lines: result, file: file.path });
          }
        }
        for (const res of endResult) {
          const linkElement = document.createElement("a");
          linkElement.href = `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}&file=${encodeURIComponent(res.file)}`;
          linkElement.textContent = `${res.file}`;
          el.appendChild(linkElement);
          for (const line of res.lines) {
            let tag = `p`;
            if (line.startsWith("#")) {
              const match = line.match(/^(#+)/);
              if (match) {
                const level = match[1].length;
                tag = `h${level}`;
              }
            }
            const element = document.createElement(tag);
            element.textContent = line.startsWith("#")
              ? line.replace(/^(#+)\s*/, "")
              : line;
            el.appendChild(element);
          }
        }
      },
    );
  }

  onunload() {}

  async loadSettings() {}

  async saveSettings() {}
}
