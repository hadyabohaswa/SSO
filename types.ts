export interface MoodleCourse {
  id: number;
  shortname: string;
  fullname: string;
  displayname: string;
  idnumber: string;
  summary: string;
  summaryformat: number;
  format: string;
  startdate: number;
  enddate: number;
  categoryid: number;
  visible: number;
  courseimage?: string;
  enrollmentmethods?: any[];
}

export interface CreateCoursePayload {
  fullname: string;
  shortname: string;
  categoryid: number;
  idnumber?: string;
  summary?: string;
  format?: string;
}

export interface MoodleUser {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname: string;
  email: string;
  department?: string;
  institution?: string;
  city?: string;
  country?: string;
  profileimageurlsmall?: string;
  auth?: string;
  suspended?: boolean;
}

export interface CreateUserPayload {
  username: string;
  password?: string; 
  firstname: string;
  lastname: string;
  email: string;
  auth?: string;
}

export interface LoginResponse {
  loginurl: string;
}

export interface UserSession {
  id: number;
  username: string;
  fullname: string;
  email: string;
  profileImage?: string;
  isAuthenticated: boolean;
  firstname?: string;
  lastname?: string;
  password?: string;
}