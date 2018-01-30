/// <reference path="../harness.ts" />

namespace ts {
    interface TestProjectSpecification {
        configFileName?: string;
        references?: string[];
        files: { [fileName: string]: string };
        outputFiles?: { [fileName: string]: string };
        config?: object;
        options?: Partial<CompilerOptions>;
    }
    interface TestSpecification {
        [path: string]: TestProjectSpecification;
    }

    function assertHasError(message: string, errors: ReadonlyArray<Diagnostic>, diag: DiagnosticMessage) {
        if (!errors.some(e => e.code === diag.code)) {
            const errorString = errors.map(e => `    ${e.file ? e.file.fileName : "[global]"}: ${e.messageText}`).join("\r\n");
            assert(false, `${message}: Did not find any diagnostic for ${diag.message} in:\r\n${errorString}`);
        }
    }

    function assertNoErrors(message: string, errors: ReadonlyArray<Diagnostic>) {
        if (errors && errors.length > 0) {
            assert(false, `${message}: Expected no errors, but found:\r\n${errors.map(e => `    ${e.messageText}`).join("\r\n")}`);
        }
    }

    function combineAllPaths(...paths: string[]) {
        let result = paths[0];
        for (let i = 1; i < paths.length; i++) {
            result = combinePaths(result, paths[i]);
        }
        return result;
    }

    const emptyModule = "export { };";

    /**
     * Produces the text of a source file which imports all of the
     * specified module names
     */
    function moduleImporting(...names: string[]) {
        return names.map((n, i) => `import * as mod_${i} from ${n}`).join("\r\n");
    }

    function testProjectReferences(spec: TestSpecification, entryPointConfigFileName: string, checkResult: (prog: Program, host: Utils.MockProjectReferenceCompilerHost) => void) {
        const files = createMap<string>();
        for (const key in spec) {
            const sp = spec[key];
            const configFileName = combineAllPaths("/", key, sp.configFileName || "tsconfig.json");
            const options = {
                compilerOptions: {
                    references: (sp.references || []).map(r => ({ path: r })),
                    referenceTarget: true,
                    outDir: "bin",
                    ...sp.options
                },
                ...sp.config
            };
            const configContent = JSON.stringify(options);
            const outDir = options.compilerOptions.outDir;
            files.set(configFileName, configContent);
            for (const sourceFile of Object.keys(sp.files)) {
                files.set(sourceFile, sp.files[sourceFile]);
            }
            if (sp.outputFiles) {
                for (const outFile of Object.keys(sp.outputFiles)) {
                    files.set(combineAllPaths("/", key, outDir, outFile), sp.outputFiles[outFile]);
                }
            }
        }

        const host = new Utils.MockProjectReferenceCompilerHost("/", /*useCaseSensitiveFileNames*/ true, files);

        const { config, error } = ts.readConfigFile(entryPointConfigFileName, name => host.readFile(name));

        // We shouldn't have any errors about invalid tsconfig files in these tests
        assert(config && !error, flattenDiagnosticMessageText(error && error.messageText, "\n"));
        const file = ts.parseJsonConfigFileContent(config, host.configHost, getDirectoryPath(entryPointConfigFileName), {}, entryPointConfigFileName);
        file.options.configFilePath = entryPointConfigFileName;
        const prog = ts.createProgram(file.fileNames, file.options, host);
        checkResult(prog, host);
    }

    describe("project-references meta check", () => {
        it("default setup was created correctly", () => {
            const spec: TestSpecification = {
                "/primary": {
                    files: { "/primary/a.ts": emptyModule },
                    references: []
                },
                "/reference": {
                    files: { "/secondary/b.ts": moduleImporting("../primary/a") },
                    references: ["../primary"]
                }
            };
            testProjectReferences(spec, "/primary/tsconfig.json", prog => {
                assert.isTrue(!!prog, "Program should exist");
                assertNoErrors("Sanity check should not produce errors", prog.getOptionsDiagnostics());
            });
        });

        it("can detect a circularity error", () => {
            const spec: TestSpecification = {
                "/primary": {
                    files: { "/primary/a.ts": emptyModule },
                    references: ["../secondary"]
                },
                "/secondary": {
                    files: { "/secondary/b.ts": moduleImporting("../primary/a") },
                    references: ["../primary"]
                }
            };
            testProjectReferences(spec, "/primary/tsconfig.json", prog => {
                assert.isTrue(!!prog, "Program should exist");
                assertHasError("Should detect a circular error", prog.getOptionsDiagnostics(), Diagnostics.Project_references_may_not_form_a_circular_graph_Cycle_detected_Colon_0);
            });
        });
    });

    /**
     * Validate that we enforce the basic settings constraints for referenced projects
     */
    describe("project-references constraint checking for settings", () => {
        it("errors when declaration = false", () => {
            const spec: TestSpecification = {
                "/primary": {
                    files: { "/primary/a.ts": emptyModule },
                    references: [],
                    options: {
                        declaration: false
                    }
                }
            };

            testProjectReferences(spec, "/primary/tsconfig.json", program => {
                const errs = program.getOptionsDiagnostics();
                assertHasError("Reports an error about the wrong decl setting", errs, Diagnostics.Projects_may_not_disable_declaration_emit);
            });
        });

        it("errors when the referenced project doesn't have referenceTarget:true", () => {
            const spec: TestSpecification = {
                "/primary": {
                    files: { "/primary/a.ts": emptyModule },
                    references: [],
                    options: {
                        referenceTarget: false
                    }
                },
                "/reference": {
                    files: { "/secondary/b.ts": moduleImporting("../primary/a") },
                    references: ["../primary"]
                }
            };
            testProjectReferences(spec, "/reference/tsconfig.json", program => {
                const errs = program.getOptionsDiagnostics();
                assertHasError("Reports an error about 'referenceTarget' not being set", errs, Diagnostics.Referenced_project_0_must_have_setting_referenceTarget_Colon_true);
            });
        });

        it("errors when the file list is not exhaustive", () => {
            const spec: TestSpecification = {
                "/primary": {
                    files: {
                        "/primary/a.ts": "import * as b from './b'",
                        "/primary/b.ts": "export {}"
                    },
                    config: {
                        files: ["a.ts"]
                    }
                }
            };

            testProjectReferences(spec, "/primary/tsconfig.json", program => {
                const errs = program.getOptionsDiagnostics();
                assertHasError("Reports an error about b.ts not being in the list", errs, Diagnostics.File_0_is_not_in_project_file_list_Projects_must_list_all_files_or_use_an_include_pattern);
            });
        });
    });

    /**
     * Circularity checking
     */
    describe("project-references circularity checking", () => {
        // Bare cycle with relative paths tested in sanity check block
        it("detects an indirected cycle", () => {
            const spec: TestSpecification = {
                "/alpha": {
                    files: { "/alpha/a.ts": emptyModule },
                    references: ["../beta"]
                },
                "/beta": {
                    files: { "/beta/b.ts": moduleImporting("../alpha/a") },
                    references: ["../gamma"]
                },
                "/gamma": {
                    files: { "/gamma/a.ts": emptyModule },
                    references: ["../alpha"],

                }
            };

            testProjectReferences(spec, "/alpha/tsconfig.json", program => {
                const errs = program.getOptionsDiagnostics();
                assertHasError("Reports an error about the circular diagnsotic", errs, Diagnostics.Project_references_may_not_form_a_circular_graph_Cycle_detected_Colon_0);
            });
        });
    });

    /**
     * Path mapping behavior
     */
    describe("project-references path mapping", () => {
        it("redirects to the output .d.ts file", () => {
            const spec: TestSpecification = {
                "/alpha": {
                    files: { "/alpha/a.ts": "export const m: number = 3;" },
                    references: [],
                    outputFiles: { "a.d.ts": emptyModule }
                },
                "/beta": {
                    files: { "/beta/b.ts": "import { m } from '../alpha/a'" },
                    references: ["../alpha"]
                }
            };
            testProjectReferences(spec, "/beta/tsconfig.json", program => {
                assertNoErrors("File setup should be correct", program.getOptionsDiagnostics());
                assertHasError("Found a type error", program.getSemanticDiagnostics(), Diagnostics.Module_0_has_no_exported_member_1);
            });
        });
    });

    describe("project-references nice-behavior", () => {
        it("issues a nice error when the input file is missing", () => {
            const spec: TestSpecification = {
                "/alpha": {
                    files: { "/alpha/a.ts": "export const m: number = 3;" },
                    references: []
                },
                "/beta": {
                    files: { "/beta/b.ts": "import { m } from '../alpha/a'" },
                    references: ["../alpha"]
                }
            };
            debugger;
            testProjectReferences(spec, "/beta/tsconfig.json", program => {
                assertHasError("Issues a useful error", program.getSemanticDiagnostics(), Diagnostics.Output_file_0_has_not_been_built_from_source_file_1);
            });
        });
    });

    /**
     * referenceTarget behavior
     */
    describe("project-references behavior changes under referenceTarget: true", () => {
        it("doesn't infer the rootDir from source paths", () => {
            const spec: TestSpecification = {
                "/alpha": {
                    files: { "/alpha/src/a.ts": "export const m: number = 3;" },
                    options: {
                        outDir: "bin"
                    },
                    references: []
                }
            };
            testProjectReferences(spec, "/alpha/tsconfig.json", (program, host) => {
                program.emit();
                assert.deepEqual(host.emittedFiles.map(e => e.fileName).sort(), ["/alpha/bin/src/a.d.ts", "/alpha/bin/src/a.js"]);
            });
        });
    });

}
