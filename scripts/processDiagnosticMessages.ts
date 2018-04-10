/// <reference path="../src/compiler/sys.ts" />
/// <reference path="../src/compiler/core.ts" />

interface DiagnosticDetails {
    category: string;
    code: number;
    reportsUnnecessary?: {};
    isEarly?: boolean;
}

type InputDiagnosticMessageTable = ts.Map<DiagnosticDetails>;

function main(): void {
    const sys = ts.sys;
    if (sys.args.length < 1) {
        sys.write("Usage:" + sys.newLine);
        sys.write("\tnode processDiagnosticMessages.js <diagnostic-json-input-file>" + sys.newLine);
        return;
    }

    function writeFile(fileName: string, contents: string) {
        const inputDirectory = ts.getDirectoryPath(inputFilePath);
        const fileOutputPath = ts.combinePaths(inputDirectory, fileName);
        sys.writeFile(fileOutputPath, contents);
    }

    const inputFilePath = sys.args[0].replace(/\\/g, "/");
    const inputStr = sys.readFile(inputFilePath);

    const diagnosticMessagesJson: { [key: string]: DiagnosticDetails } = JSON.parse(inputStr);

    const diagnosticMessages: InputDiagnosticMessageTable = ts.createMapFromTemplate(diagnosticMessagesJson);

    const outputFilesDir = ts.getDirectoryPath(inputFilePath);
    const thisFilePathRel = ts.getRelativePathToDirectoryOrUrl(outputFilesDir, sys.getExecutingFilePath(),
        sys.getCurrentDirectory(), ts.createGetCanonicalFileName(sys.useCaseSensitiveFileNames), /* isAbsolutePathAnUrl */ false);

    const infoFileOutput = buildInfoFileOutput(diagnosticMessages, "./diagnosticInformationMap.generated.ts", thisFilePathRel);
    checkForUniqueCodes(diagnosticMessages);
    writeFile("diagnosticInformationMap.generated.ts", infoFileOutput);

    const messageOutput = buildDiagnosticMessageOutput(diagnosticMessages);
    writeFile("diagnosticMessages.generated.json", messageOutput);
}

function checkForUniqueCodes(diagnosticTable: InputDiagnosticMessageTable) {
    const allCodes: { [key: number]: true | undefined } = [];
    diagnosticTable.forEach(({ code }) => {
        if (allCodes[code]) {
            throw new Error(`Diagnostic code ${code} appears more than once.`);
        }
        allCodes[code] = true;
    });
}

function buildInfoFileOutput(messageTable: InputDiagnosticMessageTable, inputFilePathRel: string, thisFilePathRel: string): string {
    let result =
        "// <auto-generated />\r\n" +
        "// generated from '" + inputFilePathRel + "' by '" + thisFilePathRel + "'\r\n" +
        "/// <reference path=\"types.ts\" />\r\n" +
        "/* @internal */\r\n" +
        "namespace ts {\r\n" +
        "    function diag(code: number, category: DiagnosticCategory, key: string, message: string, reportsUnnecessary?: {}): DiagnosticMessage {\r\n" +
        "        return { code, category, key, message, reportsUnnecessary };\r\n" +
        "    }\r\n" +
        "    // tslint:disable-next-line variable-name\r\n" +
        "    export const Diagnostics = {\r\n";
    messageTable.forEach(({ code, category, reportsUnnecessary }, name) => {
        const propName = convertPropertyName(name);
        const argReportsUnnecessary = reportsUnnecessary ? `, /*reportsUnnecessary*/ ${reportsUnnecessary}` : "";
        result += `        ${propName}: diag(${code}, DiagnosticCategory.${category}, "${createKey(propName, code)}", ${JSON.stringify(name)}${argReportsUnnecessary}),\r\n`;
    });

    result += "    };\r\n}";

    return result;
}

function buildDiagnosticMessageOutput(messageTable: InputDiagnosticMessageTable): string {
    let result = "{";
    messageTable.forEach(({ code }, name) => {
        const propName = convertPropertyName(name);
        result += `\r\n  "${createKey(propName, code)}" : "${name.replace(/[\"]/g, '\\"')}",`;
    });

    // Shave trailing comma, then add newline and ending brace
    result = result.slice(0, result.length - 1) + "\r\n}";

    // Assert that we generated valid JSON
    JSON.parse(result);

    return result;
}

function createKey(name: string, code: number): string {
    return name.slice(0, 100) + "_" + code;
}

function convertPropertyName(origName: string): string {
    let result = origName.split("").map(char => {
        if (char === "*") { return "_Asterisk"; }
        if (char === "/") { return "_Slash"; }
        if (char === ":") { return "_Colon"; }
        return /\w/.test(char) ? char : "_";
    }).join("");

    // get rid of all multi-underscores
    result = result.replace(/_+/g, "_");

    // remove any leading underscore, unless it is followed by a number.
    result = result.replace(/^_([^\d])/, "$1");

    // get rid of all trailing underscores.
    result = result.replace(/_$/, "");

    return result;
}

main();