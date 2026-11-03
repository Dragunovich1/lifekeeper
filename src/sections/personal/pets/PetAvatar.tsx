import type { Pet } from '../../../types'
import { speciesInfo } from '../../../utils/pets'

/** Foto de la mascota en un círculo; si no tiene foto, el emoji de su especie. */
export function PetAvatar({ pet, size = 64 }: { pet: Pick<Pet, 'photo' | 'species' | 'name' | 'deceasedDate'>; size?: number }) {
  return (
    <span className={`pet-avatar${pet.deceasedDate ? ' is-deceased' : ''}`} style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {pet.photo ? <img src={pet.photo} alt={`Foto de ${pet.name}`} /> : <span aria-hidden>{speciesInfo(pet.species).emoji}</span>}
    </span>
  )
}
