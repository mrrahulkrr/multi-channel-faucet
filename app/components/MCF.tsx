'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js'
import { ethers } from 'ethers'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Moon, Sun, RefreshCw, Lock, Unlock, Network } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toast } from "@/components/ui/toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ToastProvider } from '@radix-ui/react-toast'
import { id } from "ethers"

const NoSSRWrapper = dynamic(() => Promise.resolve((props: { children: React.ReactNode }) => (
    <>{props.children}</>
  )), { ssr: false })

// Network types and configurations
type NetworkKey = 'solana' | 'ethereum' | 'polygon' | 'bsc'
type NetworkInfo = {
  name: string
  symbol: string
  decimals: number
  explorer: string
}

const networks: Record<NetworkKey, NetworkInfo> = {
  solana: {
    name: 'Solana',
    symbol: 'SOL',
    decimals: 9,
    explorer: 'https://explorer.solana.com',
  },
  ethereum: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    explorer: 'https://goerli.etherscan.io',
  },
  polygon: {
    name: 'Polygon',
    symbol: 'MATIC',
    decimals: 18,
    explorer: 'https://mumbai.polygonscan.com',
  },
  bsc: {
    name: 'Binance Smart Chain',
    symbol: 'BNB',
    decimals: 18,
    explorer: 'https://testnet.bscscan.com',
  },
}

const tokenOptions: Record<NetworkKey, number[]> = {
  solana: [0.1, 0.5, 1],
  ethereum: [0.01, 0.05, 0.1],
  polygon: [0.1, 0.5, 1],
  bsc: [0.01, 0.05, 0.1],
}

type Transaction = {
  hash: string
  network: string
  amount: number
  timestamp: string
}

type FaucetBalance = Record<NetworkKey, number>
type NetworkStatus = Record<NetworkKey, 'online' | 'maintenance' | 'offline'>

export default function MultiNetworkFaucet() {
  // Move useState hooks to a client-side effect
  const [mounted, setMounted] = useState(false)
  const [state, setState] = useState({
    address: '',
    status: '',
    isLoading: false,
    network: 'solana' as NetworkKey,
    amount: tokenOptions.solana[0],
    balance: null as number | null,
    transactions: [] as Transaction[],
    isDarkMode: false,
    isLoggedIn: false,
    username: '',
    password: '',
    dailyRequestsLeft: 5,
    captchaValue: '',
    faucetBalance: {
      solana: 1000,
      ethereum: 10,
      polygon: 1000,
      bsc: 100,
    } as FaucetBalance,
    networkStatus: {
      solana: 'online',
      ethereum: 'online',
      polygon: 'online',
      bsc: 'maintenance',
    } as NetworkStatus
  })

  // Handle mounting to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
    const body = document.querySelector('body')
    if(body){
        body.removeAttribute('cz-shortcut-listen')
    }
  }, [])

  useEffect(() => {
    if (mounted) {
      if (state.isDarkMode) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [state.isDarkMode, mounted])

  // Handle network change
  useEffect(() => {
    if (mounted) {
      setState(prev => ({
        ...prev,
        amount: tokenOptions[prev.network][0]
      }))
    }
  }, [state.network, mounted])

  const updateState = (updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (state.username === 'demo' && state.password === 'password') {
      updateState({ isLoggedIn: true, dailyRequestsLeft: 5 })
    } else {
      updateState({ status: 'error' })
      setTimeout(() => updateState({ status: '' }), 3000)
    }
  }

  const handleLogout = () => {
    updateState({
      isLoggedIn: false,
      username: '',
      password: ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.isLoggedIn || state.dailyRequestsLeft <= 0 || state.captchaValue !== '12345') {
      updateState({ status: 'error' })
      setTimeout(() => updateState({ status: '' }), 3000)
      return
    }

    updateState({ isLoading: true, status: '' })

    try {
      let txHash: string
      if (state.network === 'solana') {
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed')
        const publicKey = new PublicKey(state.address)
        txHash = await connection.requestAirdrop(publicKey, state.amount * LAMPORTS_PER_SOL)
        await connection.confirmTransaction(txHash)
      } else {
        txHash = id(Date.now().toString())
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      const newTransaction: Transaction = {
        hash: txHash,
        network: state.network,
        amount: state.amount,
        timestamp: new Date().toLocaleString()
      }

      updateState({
        status: 'success',
        transactions: [newTransaction, ...state.transactions],
        dailyRequestsLeft: state.dailyRequestsLeft - 1,
        faucetBalance: {
          ...state.faucetBalance,
          [state.network]: state.faucetBalance[state.network] - state.amount
        }
      })

      await checkBalance()
    } catch (error) {
      console.error('Error:', error)
      updateState({ status: 'error' })
    } finally {
      updateState({ isLoading: false, captchaValue: '' })
    }
  }

  const checkBalance = async () => {
    try {
      if (state.network === 'solana') {
        const connection = new Connection(clusterApiUrl('devnet'), 'confirmed')
        const publicKey = new PublicKey(state.address)
        const balance = await connection.getBalance(publicKey)
        updateState({ balance: balance / LAMPORTS_PER_SOL })
      } else {
        updateState({ balance: 1 * 10 })
      }
    } catch (error) {
      console.error('Error checking balance:', error)
      updateState({ balance: null })
    }
  }

  // Don't render until client-side hydration is complete
  if (!mounted) {
    return null
  }

  return (
    <NoSSRWrapper>
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors duration-200 p-4">
        {mounted ? (
          <Card className="w-full max-w-4xl">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Multi-Network Faucet</CardTitle>
                  <CardDescription>Request tokens for testing on various networks</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={state.isDarkMode}
                    onCheckedChange={(checked) => updateState({ isDarkMode: checked })}
                  />
                  {state.isDarkMode ? (
                    <Moon className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Sun className="h-4 w-4 text-yellow-500" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!state.isLoggedIn ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={state.username}
                      onChange={(e) => updateState({ username: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={state.password}
                      onChange={(e) => updateState({ password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit">Login</Button>
                </form>
              ) : (
                <Tabs defaultValue="request" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="request">Request Tokens</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                  </TabsList>
                  <TabsContent value="request">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="network">Network</Label>
                        <Select 
                          value={state.network} 
                          onValueChange={(value: NetworkKey) => updateState({ network: value })}
                        >
                          <SelectTrigger id="network">
                            <SelectValue placeholder="Select network" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(networks).map(([key, value]) => (
                              <SelectItem key={key} value={key}>
                                {value.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`w-3 h-3 rounded-full ${
                                state.networkStatus[state.network] === 'online' ? 'bg-green-500' :
                                state.networkStatus[state.network] === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                              }`} />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Network Status: {state.networkStatus[state.network]}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div>
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          placeholder={`Enter your ${networks[state.network].name} address`}
                          value={state.address}
                          onChange={(e) => updateState({ address: e.target.value })}
                          required
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Select 
                          value={state.amount.toString()}
                          onValueChange={(value) => updateState({ amount: Number(value) })}
                        >
                          <SelectTrigger id="amount">
                            <SelectValue placeholder="Select amount" />
                          </SelectTrigger>
                          <SelectContent>
                            {tokenOptions[state.network].map((option) => (
                              <SelectItem key={option} value={option.toString()}>
                                {option} {networks[state.network].symbol}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="captcha">Captcha (Enter "12345")</Label>
                        <Input
                          id="captcha"
                          value={state.captchaValue}
                          onChange={(e) => updateState({ captchaValue: e.target.value })}
                          required
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <Button 
                          type="submit" 
                          disabled={state.isLoading || state.networkStatus[state.network] !== 'online'}
                        >
                          {state.isLoading ? 'Requesting...' : `Request ${state.amount} ${networks[state.network].symbol}`}
                        </Button>
                        <div className="text-sm">
                          Daily requests left: {state.dailyRequestsLeft}
                        </div>
                      </div>
                    </form>
                  </TabsContent>
                  <TabsContent value="transactions">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Network</TableHead>
                          <TableHead>Transaction Hash</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {state.transactions.map((tx, index) => (
                          <TableRow key={index}>
                            <TableCell>{networks[tx.network as NetworkKey].name}</TableCell>
                            <TableCell className="font-mono">
                              <a
                                href={`${networks[tx.network as NetworkKey].explorer}/tx/${tx.hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                              >
                                {tx.hash.slice(0, 8)}...{tx.hash.slice(-8)}
                              </a>
                            </TableCell>
                            <TableCell>
                              {tx.amount} {networks[tx.network as NetworkKey].symbol}
                            </TableCell>
                            <TableCell>{tx.timestamp}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
            <CardFooter className="flex flex-col items-start space-y-4">
              {state.isLoggedIn && (
                <>
                  <div className="flex space-x-4">
                    <Button 
                      variant="outline" 
                      onClick={checkBalance} 
                      disabled={!state.address}
                    >
                      Check Balance
                    </Button>
                    <Button variant="outline" onClick={handleLogout}>
                      Logout
                    </Button>
                  </div>
                  {state.balance !== null && (
                    <div className="text-sm">
                      Current balance: {state.balance.toFixed(6)} {networks[state.network].symbol}
                    </div>
                  )}
                  <div className="text-sm">
                    Faucet balance: {state.faucetBalance[state.network]} {networks[state.network].symbol}
                  </div>
                </>
              )}
            </CardFooter>
          </Card>
        ) : (
          <div className="w-full max-w-4xl h-screen flex items-center justify-center">
            <div className="animate-pulse">Loading...</div>
          </div>
        )}
      </div>
      {state.status && (
        <ToastProvider>
          <Toast
            variant={state.status === 'success' ? 'default' : 'destructive'}
            className="fixed bottom-4 right-4"
          >
            <div className="flex items-center">
              {state.status === 'success' ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : (
                <AlertCircle className="mr-2 h-4 w-4" />
              )}
              <span>
                {state.status === 'success'
                  ? `${state.amount} ${networks[state.network].symbol} has been sent to your address!`
                  : 'An error occurred. Please try again.'}
              </span>
            </div>
          </Toast>
        </ToastProvider>
      )}
    </NoSSRWrapper>
  );
};

// export default MultiNetworkFaucet;
// L