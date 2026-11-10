export type NavTab = 'home' | 'teams' | 'projects' | 'expo' | 'gallery' | 'sponsors' | 'contact' | 'announcements' | 'admin';

export interface TeamItem {
  id: string;
  title: string;
  desc: string;
  story?: string;
  activeProject?: string;
  imageUrl?: string;
  isOpen?: boolean;
  applicationUrl?: string;
  applicationDeadline?: string;
}

export interface SocialUnitInfo {
  desc: string;
  isOpen?: boolean;
  applicationUrl?: string;
}

export interface ExpoUnitInfo {
  desc: string;
  isOpen?: boolean;
  applicationUrl?: string;
}


export interface Project {
  id: string;
  name: string;
  code: string;
  category: 'havacilik' | 'roket' | 'otonom' | 'elektronik-harp';
  categoryLabel: string;
  status: string;
  image: string;
  shortDesc: string;
  fullDesc: string;
  specs: { label: string; value: string }[];
  subsystems?: { name: string; desc: string }[];
  competition: string;
  achievement: string;
  year: string;
  teamLead?: string;
  isFeatured?: boolean;
  gallery?: string[];
  story?: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: 'atolye' | 'expo' | 'saha';
  categoryLabel: string;
  imageUrl: string;
  date: string;
  location: string;
  description: string;
  timestamp?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: 'ana' | 'platin' | 'altin' | 'gumus' | 'destekci';
  tierLabel: string;
  logoUrl: string;
  website: string;
  description: string;
  supportedProjects?: string[];
}

export interface ExpoCompany {
  name: string;
  sector: string;
  logoUrl: string;
  boothNumber: string;
}

export interface ExpoScheduleItem {
  time: string;
  title: string;
  speaker: string;
  company: string;
  location: string;
}

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  summary: string;
  badge: string;
}

export interface FormSubmission {
  id: string;
  type: 'expo_participate' | 'expo_staff' | 'member_apply' | 'sponsor_request' | 'contact';
  date: string;
  data: Record<string, any>;
}

export interface PressItem {
  id: string;
  title: string;
  source: string;
  sourceUrl?: string;
  imageUrl?: string;
  date: string;
  summary: string;
  content?: string;
  category?: string;
  timestamp?: string;
}
