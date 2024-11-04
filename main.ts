import {
	Plugin,
	MarkdownRenderer,
	MarkdownPostProcessorContext,
	TFile,
} from "obsidian";

function makeLink(file: TFile, heading: string, addHeadingPath = false) {
	return `[[${file.path}#${heading}|${file.name}${addHeadingPath ? " > " + heading.replace(/#+/, "").trim() : ""}]]`;
}

function getQueryParts(query: string) {
	// Parts is an array of key value pairs of the query.
	const parts = query.split("\n");
	const partsMap = new Map<string, string>();
	parts.forEach((part) => {
		const [key, value] = part.split(":").map((str) => str.trim());
		if (key && value) {
			partsMap.set(key, value);
		}
	});
	const elementType = partsMap.get("type"); // heading or task.
	const text = partsMap.get("text");
	const pathPrefix = partsMap.get("path");
	const headingLevel = partsMap.get("level");

	if (!elementType) {
		throw new Error("Missing 'type' value in the query.");
	}
	if (["heading", "task"].indexOf(elementType) == -1) {
		throw new Error("Invalid 'type' value in the query.");
	}
	if (elementType == "heading") {
		if (!headingLevel)
			throw new Error("Missing 'level' value in the query");
		if (!text) throw new Error("Missing 'text' value in the query");
	}
	if (!pathPrefix) {
		throw new Error("Missing 'path' value in the query.");
	}
	return {
		elementType,
		text, // required with heading.
		pathPrefix,
		headingLevel, // required with heading.
	};
}

function getSectionsUnderHeading(
	lines: string[],
	file: TFile,
	headingLevel: string,
	headingText: string,
) {
	const result: string[] = [];

	for (let i = 0; i < lines.length; ) {
		const line = lines[i];
		const headingMatch =
			line == "#".repeat(parseInt(headingLevel)) + " " + headingText;
		if (!headingMatch) {
			i++;
			continue;
		}
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
		result.push(makeLink(file, headingText));
		result.push(...lines.slice(i + 1, sectionEnd));
		i = sectionEnd;
	}
	return result;
}

// getTasks returns the tasks from the given lines.
function getTasks(lines: string[], file: TFile) {
	const result: string[] = [];

	const fetchHeading = (line: number): string | undefined => {
		for (let i = line - 1; i >= 0; i--) {
			if (lines[i].startsWith("#")) {
				return lines[i].replace("#", "").trim();
			}
		}
		return;
	};

	// getBlock returns the block (list of lines) from 'start' along with it's
	// ending index.
	const getBlock = (start: number) => {
		if (lines[start].startsWith("\t")) {
			return;
		}
		let hasTask = lines[start].startsWith("- [ ]");
		let end = start + 1;
		for (; end < lines.length; end++) {
			if (lines[end].startsWith("\t")) {
				hasTask ||= lines[end].trimStart().startsWith("- [ ]");
			} else {
				break;
			}
		}
		if (hasTask) {
			return {
				lines: lines.slice(start, end),
				end: end,
			};
		}
	};

	for (let i = 0; i < lines.length; ) {
		const res = getBlock(i);
		if (res) {
			const heading = fetchHeading(i);
			if (heading) {
				result.push(makeLink(file, heading, true));
			}
			result.push(...res.lines);
			i = res.end;
		} else {
			i++;
		}
	}
	return result;
}

export default class MyPlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor(
			"md-query",
			async (
				source: string,
				el: HTMLElement,
				ctx: MarkdownPostProcessorContext,
			) => {
				const { elementType, text, pathPrefix, headingLevel } =
					getQueryParts(source);

				const endResult: Array<{ lines: string[]; file: string }> = [];

				const files = this.app.vault
					.getMarkdownFiles()
					.filter((file) => file.path.startsWith(pathPrefix));

				for (const file of files) {
					const content = await this.app.vault.read(file);
					const lines = content.split("\n");

					let result: string[] = [];

					switch (elementType) {
						case "heading":
							result = getSectionsUnderHeading(
								lines,
								file,
								headingLevel || "",
								text || "",
							);
							break;
						case "task":
							result = getTasks(lines, file);
							break;
					}

					if (result.length > 0) {
						endResult.push({ lines: result, file: file.path });
					}
				}
				for (const res of endResult) {
					const joined = res.lines.join("\n");
					MarkdownRenderer.render(
						this.app,
						joined,
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
