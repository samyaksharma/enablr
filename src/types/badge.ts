export enum BadgeType {
  FirstStep = 'first_step',
  Consistent = 'consistent',
  Dedicated = 'dedicated',
  Collector = 'collector',
  Overachiever = 'overachiever',
  Veteran = 'veteran',
  // Granted by the server for guild events
  SwornIn = 'sworn_in',
  Founder = 'founder',
  OnCamera = 'on_camera',
  GuildVeteran = 'guild_veteran',
}

export interface Badge {
  id: string;
  userId: string;
  badgeType: BadgeType;
  earnedAt: string;
  synced: boolean;
}

export interface BadgeDefinition {
  type: BadgeType;
  name: string;
  description: string;
  hint: string;
}
