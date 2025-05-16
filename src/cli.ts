#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs';
import { createCodeGraph } from './index';
import { logger } from './utils/file-utils';

// Set up the program
program
    .name('code-graph-generator')
    .description('Generate a code graph for JavaScript/TypeScript projects')
    .version('1.0.3');

// Define command-line options
program
    .argument('<projectPath>', 'Path to the project directory')
    .option('-o, --output <path>', 'Output path for the generated graph')
    .option('-i, --include <patterns...>', 'File patterns to include (default: **/*.js, **/*.jsx, **/*.ts, **/*.tsx)')
    .option('-e, --exclude <patterns...>', 'File patterns to exclude')
    .option('-d, --debug', 'Enable debug logging')
    .option('-c, --concurrency <number>', 'Number of concurrent file operations', '10')
    .option('--include-declarations', 'Include .d.ts files in analysis')
    .option('--include-node-modules', 'Include node_modules in analysis (not recommended)')
    .option('--stream', 'Stream output directly without relationship analysis')
    .option('--pretty', 'Format the output JSON with indentation')
    .action(async (projectPath, options) => {
        try {
            // Validate project path
            const rootDir = path.resolve(process.cwd(), projectPath);
            if (!fs.existsSync(rootDir)) {
                console.error(chalk.red(`Error: Project directory ${rootDir} does not exist`));
                process.exit(1);
            }

            // Set up options
            const projectName = path.basename(rootDir);
            const outputPath = options.output
                ? path.resolve(process.cwd(), options.output)
                : path.join(process.cwd(), 'code-graph.json');

            // Set up spinner
            const spinner: any = ora('Analyzing codebase...').start();

            // Configure code graph options
            const graphOptions = {
                projectName,
                rootDir,
                include: options.include,
                exclude: options.exclude,
                concurrency: parseInt(options.concurrency, 10),
                includeDeclarations: options.includeDeclarations || false,
                includeNodeModules: options.includeNodeModules || false,
                debug: options.debug || false,
                outputPath,
                streamOutput: options.stream || false,
            };

            // Set up custom logger for CLI
            logger.setDebug(options.debug);

            if (options.debug) {
                // In debug mode, show all logs directly
                logger.info = (message, ...args) => {
                    spinner.stop();
                    console.info(chalk.blue(`[CodeGraph] ${message}`), ...args);
                    spinner.start();
                };
                logger.warn = (message, ...args) => {
                    spinner.stop();
                    console.warn(chalk.yellow(`[CodeGraph] ${message}`), ...args);
                    spinner.start();
                };
                logger.error = (message, ...args) => {
                    spinner.stop();
                    console.error(chalk.red(`[CodeGraph] ${message}`), ...args);
                    spinner.start();
                };
            } else {
                // In normal mode, suppress most logs
                logger.info = () => { };
                logger.warn = () => { };
                logger.error = (message, ...args) => {
                    spinner.stop();
                    console.error(chalk.red(`[CodeGraph] ${message}`), ...args);
                    spinner.start();
                };
            }

            // Generate the code graph
            const graph = await createCodeGraph(graphOptions);

            // If output path wasn't specified in options, write to stdout or to file
            if (!options.output) {
                spinner.succeed('Code graph generated');
                if (options.pretty) {
                    console.log(JSON.stringify(graph, null, 2));
                } else {
                    console.log(JSON.stringify(graph));
                }
            } else {
                spinner.succeed(`Code graph written to ${outputPath}`);
            }
        } catch (error: any) {
            // spinner?.fail('Error generating code graph');
            console.error(chalk.red(`Error: ${error.message}`));
            if (options.debug) {
                console.error(error);
            }
            process.exit(1);
        }
    });

program.parse();