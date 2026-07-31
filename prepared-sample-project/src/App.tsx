import { Routes, Route } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
export default function App() { return <><AppHeader /><Routes><Route path="/login" element={<LoginPage />} /><Route path="/dashboard" element={<DashboardPage />} /></Routes></> }
