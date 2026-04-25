const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv)).argv;
const inputFile = argv['input-file'];

if (!inputFile) {
    console.error('Error: missing --input-file argument');
    process.exit(1);
}

try {
    const sourceCode = fs.readFileSync(path.join(__dirname, inputFile), 'utf-8');
    const lines = sourceCode.split('\n');

    let jsOutput = [];
    let braceStack = [];
    let lastWasIf = false;

    lines.forEach((line, index) => {
        line = line.trim();
        if (!line || line.startsWith('//')) return;

        const ifMatch = line.match(/^if\s*\[(.+?)\]\s*\{$/);
        if (ifMatch) {
            jsOutput.push(`if (${ifMatch[1]}) {`);
            braceStack.push('{');
            lastWasIf = true;
            return;
        }

        const elseMatch = line.match(/^else\s*\{$/);
        if (elseMatch) {
            if (!lastWasIf) {
                throw new Error(`Syntax Error: 'else' without matching 'if' at line ${index + 1}`);
            }
            jsOutput.push(`} else {`);
            lastWasIf = false;
            return;
        }

        if (line === '}' || line === 'end') {
            jsOutput.push(`}`);
            braceStack.pop();
            lastWasIf = false;
            return;
        }

        const funcMatch = line.match(/^func\s+(\w+)\s*\((.*)\)\s+do:$/);
        if (funcMatch) {
            jsOutput.push(`function ${funcMatch[1]}(${funcMatch[2]}) {`);
            braceStack.push('{');
            return;
        }

        const loopMatch = line.match(/^loop\s+(\w+)\s*=\s*(\d+),\s*(\d+)\s+do:$/);
        if (loopMatch) {
            jsOutput.push(`for (let ${loopMatch[1]} = ${loopMatch[2]}; ${loopMatch[1]} <= ${loopMatch[3]}; ${loopMatch[1]}++) {`);
            braceStack.push('{');
            return;
        }

        const varMatch = line.match(/^var\s+\{(.+?)\}\s+(.+?)\s*=\s*(.+)$/);
        if (varMatch) {
            const [_, type, name, value] = varMatch;
            const jsVar = type === 'public' ? 'var' : 'let';
            jsOutput.push(`${jsVar} ${name} = ${value};`);
            return;
        }

        const printMatch = line.match(/^with\s+"Core",?\s+print\s*\((.+)\)$/);
        if (printMatch) {
            jsOutput.push(`console.log(${printMatch[1]});`);
            return;
        }

        if (/^\w+\s*\([^)]*\)$/.test(line)) {
            jsOutput.push(line + ';');
            return;
        }

        if (/^\w+$/.test(line)) {
            throw new Error(`Syntax Error: Function calls must include parentheses '()' at line ${index + 1}`);
        }
    });

    if (braceStack.length !== 0) {
        throw new Error('Syntax Error: missing closing braces');
    }

    fs.writeFileSync('output.js', jsOutput.join('\n'));
    console.log('Successfully compiled .iwo to .js');

} catch (err) {
    console.error('Compilation failed: ' + err.message);
}
