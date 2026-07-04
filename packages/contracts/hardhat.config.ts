try {
  require("@nomicfoundation/hardhat-toolbox");
} catch (error) {
  // Fallback in case a toolbox peer dependency ever goes missing again — compile
  // still works without the full toolbox, just without its extra chai matchers/tasks.
  console.warn("[hardhat] toolbox unavailable, using core compiler only:", (error as Error).message);
}

try {
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config();
} catch {
  // dotenv opcional
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  paths: {
    sources: "./contracts",
  },
  // Compilador 0.8.24 — requerido por OpenZeppelin ERC4626
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  // Configuración de redes de desarrollo y producción
  networks: {
    // Red interna local para correr los tests de estrés al instante
    hardhat: {
      chainId: 31337,
    },
    // Red de pruebas para simular emisiones y lógica de dividendos sin costo
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Producción: Red recomendada para RWA por bajos costos de transacción
    polygon: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    }
  },
  // Verificación de contratos (Fundamental para transparencia e inversores)
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || ""
    }
  }
};
