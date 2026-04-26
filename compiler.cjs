const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { exec } = require("child_process");

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
    let insideFunction = false;

    lines.forEach((line, index) => {
        line = line.trim();
        if (!line || line.startsWith('//')) return;

        // if
        const ifMatch = line.match(/^if\s*\[(.+?)\]\s*\{$/);
        if (ifMatch) {
            jsOutput.push(`if (${ifMatch[1]}) {`);
            braceStack.push('{');
            lastWasIf = true;
            return;
        }

        // else
        const elseMatch = line.match(/^else\s*\{$/);
        if (elseMatch) {
            if (!lastWasIf) {
                throw new Error(`Syntax Error: 'else' without matching 'if' at line ${index + 1}`);
            }
            jsOutput.push(`} else {`);
            lastWasIf = false;
            return;
        }

        // closing braces
        if (line === '}' || line === 'end') {
            jsOutput.push(`}`);
            braceStack.pop();
            lastWasIf = false;

            if (braceStack.length === 0) {
                insideFunction = false;
            }

            return;
        }

        // function
        const funcMatch = line.match(/^func\s+(\w+)\s*\((.*)\)\s+do:$/);
        if (funcMatch) {
            jsOutput.push(`function ${funcMatch[1]}(${funcMatch[2]}) {`);
            braceStack.push('{');
            insideFunction = true;
            return;
        }

        // loop
        const loopMatch = line.match(/^loop\s+(\w+)\s*=\s*(\d+),\s*(\d+)\s+do:$/);
        if (loopMatch) {
            jsOutput.push(`for (let ${loopMatch[1]} = ${loopMatch[2]}; ${loopMatch[1]} <= ${loopMatch[3]}; ${loopMatch[1]}++) {`);
            braceStack.push('{');
            return;
        }

        // variable
        const varMatch = line.match(/^var\s+\{(.+?)\}\s+(.+?)\s*=\s*(.+)$/);
        if (varMatch) {
            const [_, type, name, value] = varMatch;
            const jsVar = type === 'public' ? 'var' : 'let';
            jsOutput.push(`${jsVar} ${name} = ${value};`);
            return;
        }

        // print
        const printMatch = line.match(/^with\s+"Core",?\s+print\s*\((.+)\)$/);
        if (printMatch) {
            jsOutput.push(`console.log(${printMatch[1]});`);
            return;
        }

        // list creation
        const listMatch = line.match(/^list\s+(\w+)\s*=\s*\[(.*)\]$/);
        if (listMatch) {
            const [_, name, items] = listMatch;
            jsOutput.push(`let ${name} = [${items}];`);
            return;
        }

        // push to list
        const pushMatch = line.match(/^push\s+(\w+)\s+(.+)$/);
        if (pushMatch) {
            const [_, arr, value] = pushMatch;
            jsOutput.push(`${arr}.push(${value});`);
            return;
        }

        // pop from list
        const popMatch = line.match(/^pop\s+(\w+)$/);
        if (popMatch) {
            const [_, arr] = popMatch;
            jsOutput.push(`${arr}.pop();`);
            return;
        }

        // len assignment
        const lenAssignMatch = line.match(/^(\w+)\s*=\s*len\s+(\w+)$/);
        if (lenAssignMatch) {
            const [_, target, arr] = lenAssignMatch;
            jsOutput.push(`let ${target} = ${arr}.length;`);
            return;
        }

        // return with value
        const returnMatch = line.match(/^return\s+(.+)$/);
        if (returnMatch) {
            if (!insideFunction) {
                throw new Error(`Syntax Error: 'return' outside function at line ${index + 1}`);
            }
            jsOutput.push(`return ${returnMatch[1]};`);
            return;
        }

        // return empty
        const returnEmpty = line.match(/^return\s*$/);
        if (returnEmpty) {
            if (!insideFunction) {
                throw new Error(`Syntax Error: 'return' outside function at line ${index + 1}`);
            }
            jsOutput.push(`return;`);
            return;
        }

        throw new Error(`Syntax Error: invalid statement at line ${index + 1}`);
    });

    if (braceStack.length !== 0) {
        throw new Error('Syntax Error: missing closing braces');
    }

    fs.writeFileSync('output.js', jsOutput.join('\n'));
    console.log('Successfully compiled .iwo to .js');

} catch (err) {
    console.error('Compilation failed: ' + err.message);
}

exec("node output.js", (err, stdout, stderr) => {
  if (err) {
    console.error(err);
    return;
  }

  console.log(stdout);

fs.unlinkSync('output.js');
