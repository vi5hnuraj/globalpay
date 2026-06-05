import { ethers } from 'ethers';
import solc from 'solc';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const contractSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PlatformUSDC {
    string public name = "Platform USDC";
    string public symbol = "pUSDC";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    address public treasury;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    // Custom events for bridging
    event FiatMinted(address indexed to, uint256 amount, uint256 timestamp);
    event FiatBurned(address indexed from, uint256 amount, uint256 timestamp);

    constructor() {
        treasury = msg.sender;
    }

    modifier onlyTreasury() {
        require(msg.sender == treasury, "Only Treasury can execute");
        _;
    }

    // ERC-20 Transfer
    function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    // ERC-20 Approve
    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // ERC-20 TransferFrom
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(allowance[from][msg.sender] >= amount, "Allowance exceeded");
        require(balanceOf[from] >= amount, "Insufficient balance");
        
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    // Treasury controlled Mint (On-Ramp)
    function depositFiat(address userAddress, uint256 amount) public onlyTreasury {
        balanceOf[userAddress] += amount;
        totalSupply += amount;
        emit Transfer(address(0), userAddress, amount);
        emit FiatMinted(userAddress, amount, block.timestamp);
    }

    // Treasury controlled Burn (Off-Ramp)
    function withdrawFiat(address userAddress, uint256 amount) public onlyTreasury {
        require(balanceOf[userAddress] >= amount, "Insufficient balance to withdraw");
        balanceOf[userAddress] -= amount;
        totalSupply -= amount;
        emit Transfer(userAddress, address(0), amount);
        emit FiatBurned(userAddress, amount, block.timestamp);
    }

    // Treasury controlled forced transfer (Custodial Feature)
    function executeTransfer(address senderAddress, address receiverAddress, uint256 amount) public onlyTreasury {
        require(balanceOf[senderAddress] >= amount, "Insufficient balance");
        
        balanceOf[senderAddress] -= amount;
        balanceOf[receiverAddress] += amount;
        
        emit Transfer(senderAddress, receiverAddress, amount);
    }
}
`;

async function deploy() {
    console.log("Compiling PlatformVault contract...");
    
    const input = {
        language: 'Solidity',
        sources: {
            'PlatformVault.sol': {
                content: contractSource
            }
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*']
                }
            }
        }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    if (output.errors) {
        let hasError = false;
        output.errors.forEach(err => {
            if (err.severity === 'error') hasError = true;
            console.error(err.formattedMessage);
        });
        if (hasError) return;
    }

    const contract = output.contracts['PlatformVault.sol']['PlatformUSDC'];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    console.log("PlatformUSDC compiled successfully!");

    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const privateKey = process.env.TREASURY_PRIVATE_KEY;

    if (!rpcUrl || !privateKey) {
        console.error("Missing RPC URL or Private Key in .env");
        return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("Deploying Vault using Treasury Wallet:", wallet.address);

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    try {
        const deployedContract = await factory.deploy();
        await deployedContract.waitForDeployment();
        const address = await deployedContract.getAddress();
        
        console.log("\\n============================================");
        console.log("🎉 VAULT DEPLOYED SUCCESSFULLY!");
        console.log("Contract Address:", address);
        console.log("============================================\\n");
        
        // Save the ABI and Address to a file so the backend can use it
        const contractData = {
            address: address,
            abi: abi
        };
        fs.writeFileSync('./contractData.json', JSON.stringify(contractData, null, 2));
        console.log("Saved Vault address and ABI to contractData.json");

    } catch (err) {
        console.error("Deployment failed:", err);
    }
}

deploy();
