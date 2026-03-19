export enum CharacterClass {
  Warrior = 'warrior',
  Mage = 'mage',
  Rogue = 'rogue',
}

export interface User {
  id: string;
  name: string;
  characterName: string;
  characterClass: CharacterClass;
  xp: number;
  level: number;
  createdAt: string;
}
