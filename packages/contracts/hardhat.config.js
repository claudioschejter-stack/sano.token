require("@nomicfoundation/hardhat-toolbox");

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
  // Configuración estricta del compilador para todos tus contratos (0.8.20)
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Optimiza el peso del gas para la lógica de Whitelist
      },
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