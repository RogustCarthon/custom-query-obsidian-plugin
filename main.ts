import { Plugin, MarkdownRenderer } from "obsidian";

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
        const endResult: Array<{ lines: string[]; file: string }> = [];

        const files = this.app.vault.getMarkdownFiles();

        for (const file of files) {
          if (!file.path.startsWith(prefix)) continue;

          const content = await this.app.vault.read(file);
          const lines = content.split("\n");

          const result: string[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headingMatch =
              line == "#".repeat(parseInt(headingLevel)) + " " + headingText;
            if (!headingMatch) {
              continue;
            } else {
              let sectionEnd = lines.length;
              for (let j = i + 1; j < lines.length; j++) {
                const nextLine = lines[j];
                if (
                  nextLine.startsWith("#") &&
                  nextLine.split(" ")[0].length <= parseInt(headingLevel)
                ) {
                  sectionEnd = j;
                  break;
                }
              }
              result.push(`[[${file.path}#${headingText}|${file.name}]]`);
              result.push(...lines.slice(i + 1, sectionEnd));
              break;
            }
          }

          if (result.length > 0) {
            endResult.push({ lines: result, file: file.path });
          }
        }
        for (const res of endResult) {
          MarkdownRenderer.render(
            this.app,
            res.lines.join("\n"),
            el,
            res.file,
            this,
          );
        }
      },
    );
  }

  onunload() {}

  async loadSettings() {}

  async saveSettings() {}
}
