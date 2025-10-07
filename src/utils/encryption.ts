import CryptoJS from 'crypto-js'

export const hashPassword = (password: string) => CryptoJS.SHA256(password).toString()

export const encryptObject = (payload: unknown, secret: string) => {
  const serialized = JSON.stringify(payload)
  return CryptoJS.AES.encrypt(serialized, secret).toString()
}

export const decryptObject = <T>(ciphertext: string, secret: string): T => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secret)
  const decoded = bytes.toString(CryptoJS.enc.Utf8)
  if (!decoded) {
    throw new Error('No se pudo descifrar la información con la contraseña proporcionada')
  }

  return JSON.parse(decoded) as T
}
