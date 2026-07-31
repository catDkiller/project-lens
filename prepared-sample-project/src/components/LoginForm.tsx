import { signIn } from '../services/authService'
export function LoginForm() { void signIn; return <form><input type="email" /><input type="password" /></form> }
