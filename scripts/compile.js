import fs from 'node:fs'
import path from 'node:path'
import solc from 'solc'

const files = [
  'contracts/GMBoard.sol',
  'contracts/SimpleStorage.sol',
  'contracts/UserCreatedToken.sol'
]

const sources = {}

for (const file of files) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing source: ${file}`)
  }

  sources[file] = {
    content: fs.readFileSync(file, 'utf8')
  }
}

function findImports(importPath) {
  const fullPath = path.resolve('node_modules', importPath)

  if (!fs.existsSync(fullPath)) {
    return { error: `Import not found: ${importPath}` }
  }

  return {
    contents: fs.readFileSync(fullPath, 'utf8')
  }
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    evmVersion: 'shanghai',
    outputSelection: {
      '*': {
        '*': [
          'abi',
          'evm.bytecode.object',
          'evm.deployedBytecode.object'
        ]
      }
    }
  }
}

const output = JSON.parse(
  solc.compile(JSON.stringify(input), { import: findImports })
)

if (output.errors) {
  for (const error of output.errors) {
    console.log(error.formattedMessage)
  }

  if (output.errors.some(e => e.severity === 'error')) {
    process.exit(1)
  }
}

for (const file of files) {
  const contracts = output.contracts?.[file]

  if (!contracts) {
    throw new Error(`Compilation output missing: ${file}`)
  }

  for (const [name, artifact] of Object.entries(contracts)) {
    const bytecode = artifact.evm.bytecode.object

    if (!bytecode) {
      throw new Error(`Empty bytecode: ${name}`)
    }

    fs.writeFileSync(
      `artifacts/${name}.json`,
      JSON.stringify({
        contractName: name,
        sourceName: file,
        abi: artifact.abi,
        bytecode: `0x${bytecode}`,
        deployedBytecode: `0x${artifact.evm.deployedBytecode.object}`
      }, null, 2)
    )

    console.log(`Compiled: ${name}`)
  }
}

console.log('All contracts compiled successfully.')
