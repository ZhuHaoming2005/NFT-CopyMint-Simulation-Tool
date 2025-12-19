#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from web3 import Web3
import json

# 预定义的网络配置
NETWORKS = {
    "1": {
        "name": "Ethereum Sepolia (测试网)",
        "rpc": "https://eth-sepolia.g.alchemy.com/v2/mIT4inrExfxdYLGFwodu5",
        "chainId": 11155111
    },
    "2": {
        "name": "BSC Testnet (测试网)",
        "rpc": "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
        "chainId": 97
    },
    "3": {
        "name": "Polygon Amoy (测试网)",
        "rpc": "https://rpc-amoy.polygon.technology",
        "chainId": 80002
    },
    "4": {
        "name": "Base Sepolia (测试网)",
        "rpc": "https://base-sepolia-rpc.publicnode.com",
        "chainId": 84532
    },
    "5": {
        "name": "Ethereum Mainnet (主网)",
        "rpc": "https://eth.public-rpc.com",
        "chainId": 1
    },
    "6": {
        "name": "BSC Mainnet (主网)",
        "rpc": "https://bsc-dataseed.binance.org",
        "chainId": 56
    },
    "7": {
        "name": "Polygon Mainnet (主网)",
        "rpc": "https://polygon-rpc.com",
        "chainId": 137
    },
    "8": {
        "name": "Base Mainnet (主网)",
        "rpc": "https://mainnet.base.org",
        "chainId": 8453
    }
}

# ERC721标准ABI - 包含常用的查询方法
ERC721_ABI = json.loads('''[
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "tokenURI",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "name",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"internalType": "string", "name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function"
    }
]''')

def main():
    print("=" * 60)
    print("NFT合约查询工具")
    print("=" * 60)
    
    # 显示网络选项
    print("\n请选择区块链网络:")
    print("-" * 60)
    print("  【测试网】")
    for key in ["1", "2", "3", "4"]:
        network = NETWORKS[key]
        print(f"    {key}. {network['name']}")
    print("\n  【主网】")
    for key in ["5", "6", "7", "8"]:
        network = NETWORKS[key]
        print(f"    {key}. {network['name']}")
    print("\n    9. 自定义RPC URL")
    print("-" * 60)
    
    # 获取网络选择
    network_choice = input("请输入网络编号 (1-9): ").strip()
    
    if network_choice == "9":
        # 自定义RPC
        print("\n请输入自定义RPC URL:")
        rpc_url = input("RPC URL: ").strip()
        print(f"\n已选择: 自定义RPC")
    elif network_choice in NETWORKS:
        # 预定义网络
        selected_network = NETWORKS[network_choice]
        rpc_url = selected_network["rpc"]
        print(f"\n已选择: {selected_network['name']}")
    else:
        print("Error: 无效的网络选择")
        return
    
    print(f"RPC URL: {rpc_url}")
    
    # 获取合约地址
    print("\n" + "-" * 60)
    contract_address = input("合约地址: ").strip()
    
    # 获取tokenID
    token_id = input("Token ID: ").strip()
    
    try:
        # 连接到区块链
        web3 = Web3(Web3.HTTPProvider(rpc_url))
        
        if not web3.is_connected():
            print("Error: 无法连接到区块链节点，请检查RPC URL")
            return
        
        print("Success: 成功连接到区块链")
        
        # 转换地址格式
        contract_address = Web3.to_checksum_address(contract_address)
        token_id = int(token_id)
        
        # 创建合约实例
        contract = web3.eth.contract(address=contract_address, abi=ERC721_ABI)
        
        print("\n" + "=" * 60)
        print("查询结果")
        print("=" * 60)
        
        # 查询合约基本信息
        print(f"网络：{selected_network['name']}")
        try:
            name = contract.functions.name().call()
            print(f"\n合约名称: {name}")
        except Exception as e:
            print(f"\n合约名称: (无法获取)")
        
        try:
            symbol = contract.functions.symbol().call()
            print(f"合约符号: {symbol}")
        except Exception as e:
            print(f"合约符号: (无法获取)")
        
        try:
            total_supply = contract.functions.totalSupply().call()
            print(f"总供应量: {total_supply}")
        except Exception as e:
            print(f"总供应量: (无法获取)")
        
        print(f"\n查询的Token ID: {token_id}")
        
        # 查询tokenURI
        try:
            token_uri = contract.functions.tokenURI(token_id).call()
            print(f"Token URI: {token_uri}")
        except Exception as e:
            print(f"Token URI: 无法获取 ({str(e)})")
        
        # 查询owner
        try:
            owner = contract.functions.ownerOf(token_id).call()
            print(f"拥有者地址: {owner}")
        except Exception as e:
            print(f"拥有者地址: 无法获取 ({str(e)})")
        
        print("\n" + "=" * 60)
        print("查询完成!")
        print("=" * 60)
        
    except ValueError as e:
        print(f"\n输入格式错误: {str(e)}")
    except Exception as e:
        print(f"\n查询失败: {str(e)}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n程序已退出")
    except Exception as e:
        print(f"\n程序错误: {str(e)}")

