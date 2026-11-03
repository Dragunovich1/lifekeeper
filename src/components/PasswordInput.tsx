import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/** Campo de contraseña con "ojito" para ver lo que se escribió. Hereda el estilo `.auth-input`. */
export function PasswordInput({ className = 'auth-input', ...rest }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="pw-wrap">
      <input {...rest} className={`${className} pw-input`} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  )
}
