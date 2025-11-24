import { MOODLE_CONFIG } from '../constants';
import { MoodleCourse, MoodleUser, CreateUserPayload, CreateCoursePayload, LoginResponse } from '../types';

/**
 * Helper to convert complex objects to Moodle's expected URL-encoded array format.
 * Recursive function to handle nested objects and arrays.
 */
const toMoodleParams = (params: Record<string, any>, prefix = ''): URLSearchParams => {
  const searchParams = new URLSearchParams();

  Object.keys(params).forEach((key) => {
    const value = params[key];
    const newKey = prefix ? `${prefix}[${key}]` : key;

    if (value === undefined || value === null) {
      return;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          const arrayKey = `${newKey}[${index}]`;
          if (typeof item === 'object') {
             const nestedParams = toMoodleParams(item, arrayKey);
             nestedParams.forEach((nestedVal, nestedKey) => {
                searchParams.append(nestedKey, nestedVal);
             });
          } else {
             searchParams.append(arrayKey, String(item));
          }
        });
      } else {
        const nestedParams = toMoodleParams(value, newKey);
        nestedParams.forEach((nestedVal, nestedKey) => {
            searchParams.append(nestedKey, nestedVal);
        });
      }
    } else {
      searchParams.append(newKey, String(value));
    }
  });

  return searchParams;
};

// Generic Moodle Fetcher
async function moodleFetch<T>(functionName: string, params: Record<string, any> = {}): Promise<T> {
  const queryParams = new URLSearchParams();
  queryParams.append('wstoken', MOODLE_CONFIG.TOKEN);
  queryParams.append('wsfunction', functionName);
  queryParams.append('moodlewsrestformat', 'json');

  const dataParams = toMoodleParams(params);
  
  try {
    // Note: We do NOT set Content-Type manually for URLSearchParams. 
    // The browser correctly sets 'application/x-www-form-urlencoded; charset=UTF-8'.
    const response = await fetch(`${MOODLE_CONFIG.ENDPOINT}?${queryParams.toString()}`, {
      method: 'POST', 
      body: dataParams,
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();

    // Moodle sometimes returns an exception object
    if (data && (data.exception || data.errorcode)) {
      throw new Error(`Moodle API Exception: ${data.message || data.errorcode} (${data.errorcode})`);
    }

    return data as T;
  } catch (error) {
    console.error(`Moodle API Error (${functionName}):`, error);
    throw error;
  }
}

// --- API Methods ---

export const getCourses = async (): Promise<MoodleCourse[]> => {
  const errors: string[] = [];

  // Strategy 1: 'core_course_search_courses' (Most permissive)
  try {
    const data = await moodleFetch<any>('core_course_search_courses', {
      criterianame: 'search',
      criteriavalue: ' ' 
    });
    
    if (data && Array.isArray(data.courses)) return data.courses;
    if (Array.isArray(data)) return data;
  } catch (e: any) {
    errors.push(`search_courses: ${e.message}`);
  }

  // Strategy 2: 'core_course_get_courses' (System context)
  try {
    const data = await moodleFetch<any>('core_course_get_courses', {
      options: { ids: [] } 
    });
    
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.courses)) return data.courses;
  } catch (e: any) {
    errors.push(`get_courses: ${e.message}`);
  }

  // Strategy 3: 'core_course_get_courses_by_field' (Category fallback)
  try {
    const data = await moodleFetch<any>('core_course_get_courses_by_field', {
      field: 'category',
      value: 1
    });

    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.courses)) return data.courses;
  } catch (e: any) {
    errors.push(`get_courses_by_field: ${e.message}`);
  }

  console.error("All course fetch strategies failed:", errors);
  // Throw error instead of returning empty so UI can show the message
  if (errors.length > 0) {
    throw new Error(`Unable to fetch courses. Details: ${errors.join(' | ')}`);
  }
  return [];
};

export const getUserCourses = async (userId: number): Promise<MoodleCourse[]> => {
  try {
    const data = await moodleFetch<any>('core_enrol_get_users_courses', {
      userid: userId
    });
    if (Array.isArray(data)) return data;
    return [];
  } catch (e: any) {
    console.warn("Failed to fetch user courses:", e);
    // Propagate error to UI
    throw new Error(`Failed to fetch user courses: ${e.message}`);
  }
};

export const createCourse = async (course: CreateCoursePayload): Promise<MoodleCourse[]> => {
  return moodleFetch<MoodleCourse[]>('core_course_create_courses', {
    courses: [course]
  });
};

export const getUsers = async (): Promise<MoodleUser[]> => {
  const response = await moodleFetch<{ users: MoodleUser[] }>('core_user_get_users', {
    criteria: [{ key: 'email', value: '%' }]
  });
  return response?.users || [];
};

export const createUser = async (user: CreateUserPayload): Promise<MoodleUser[]> => {
  try {
    // Attempt 1: Standard Admin Creation
    return await moodleFetch<MoodleUser[]>('core_user_create_users', {
      users: [user]
    });
  } catch (error: any) {
    // Attempt 2: Fallback to Signup (if permissions are missing for create_users)
    if (error.message && (error.message.includes('nopermissions') || error.message.includes('access'))) {
      console.warn("Admin creation failed (nopermissions). Attempting auth_email_signup_user fallback...");
      try {
        const signupResult = await moodleFetch<any>('auth_email_signup_user', {
          username: user.username,
          password: user.password,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          city: 'Dubai', // Default required fields
          country: 'AE'
        });

        if (signupResult && (signupResult.success === true || signupResult.success === 'true')) {
          // Return a mock user object because signup API doesn't return the user
          return [{
            id: 0, // Pending ID
            username: user.username,
            firstname: user.firstname,
            lastname: user.lastname,
            fullname: `${user.firstname} ${user.lastname}`,
            email: user.email,
            auth: 'manual',
            suspended: true // User is likely pending confirmation
          }];
        }
      } catch (fallbackError) {
        console.error("Fallback signup also failed:", fallbackError);
      }
    }
    // Throw the original error if fallback didn't work
    throw error;
  }
};

export const getUserByField = async (field: 'username' | 'email', value: string): Promise<MoodleUser | null> => {
  // Moodle usernames are strictly lowercase. Force lowercase to ensure search works.
  const searchValue = (field === 'username') ? value.toLowerCase() : value;
  
  try {
    // Strategy 1: core_user_get_users
    const response = await moodleFetch<{ users: MoodleUser[] }>('core_user_get_users', {
      criteria: [{ key: field, value: searchValue }]
    });
    
    if (response && Array.isArray(response.users) && response.users.length > 0) {
      return response.users[0];
    }

    // Strategy 2: core_user_get_users_by_field (Fallback for older APIs or different permissions)
    try {
      const responseFallback = await moodleFetch<MoodleUser[]>('core_user_get_users_by_field', {
        field: field,
        values: [searchValue]
      });
      if (Array.isArray(responseFallback) && responseFallback.length > 0) {
        return responseFallback[0];
      }
    } catch (fallbackErr) {
        console.warn("Fallback user search failed:", fallbackErr);
    }

    return null;
  } catch (e: any) {
    console.error("Error finding user:", e);
    // If it's a permission error, throw it so the UI knows.
    if (e.message && (e.message.includes('nopermissions') || e.message.includes('access'))) {
        throw new Error(`Access Denied: ${e.message}`);
    }
    return null;
  }
};

/**
 * Generates a One-Time Login URL.
 * Implements a "Try Everything" strategy (POST and GET) to ensure compatibility
 * with various Moodle server configurations regarding parameter parsing.
 */
export const getSSOLoginUrl = async (userId: number, username: string, email: string): Promise<string> => {
  
  // Helper to fetch using either POST or GET
  const fetchSSO = async (userParams: Record<string, string>, method: 'POST' | 'GET' = 'POST') => {
    const url = new URL(MOODLE_CONFIG.ENDPOINT);
    url.searchParams.append('wstoken', MOODLE_CONFIG.TOKEN);
    url.searchParams.append('wsfunction', 'auth_userkey_request_login_url');
    url.searchParams.append('moodlewsrestformat', 'json');
    
    let response;

    if (method === 'GET') {
       // Append params to URL: user[key]=value
       Object.keys(userParams).forEach((key) => {
          url.searchParams.append(`user[${key}]`, userParams[key]);
       });
       console.log(`[SSO Service] Requesting (GET) ${url.toString()}`);
       response = await fetch(url.toString(), { method: 'GET' });
    } else {
       // POST Body: user[key]=value
       const bodyParams = new URLSearchParams();
       Object.keys(userParams).forEach((key) => {
           bodyParams.append(`user[${key}]`, userParams[key]);
       });
       console.log(`[SSO Service] Requesting (POST) with params:`, Object.fromEntries(bodyParams));
       response = await fetch(url.toString(), { 
           method: 'POST',
           body: bodyParams
       });
    }
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    if (data && (data.exception || data.errorcode)) {
      throw new Error(`Moodle API Exception: ${data.message || data.errorcode} (${data.errorcode})`);
    }
    return data as LoginResponse;
  };

  const errors: string[] = [];

  // Strategy 1: Username (Lowercase) - POST (Standard)
  if (username) {
    const safeUsername = username.trim().toLowerCase();
    try {
      const res = await fetchSSO({ username: safeUsername }, 'POST');
      if (res?.loginurl) return res.loginurl;
    } catch (e: any) {
      errors.push(`Username(lc/POST): ${e.message}`);
    }
    
    // Strategy 2: Username (Lowercase) - GET (Fallback for server parsing issues)
    try {
      const res = await fetchSSO({ username: safeUsername }, 'GET');
      if (res?.loginurl) return res.loginurl;
    } catch (e: any) {
      errors.push(`Username(lc/GET): ${e.message}`);
    }

    // Strategy 3: Username (Raw) - POST (If casing matters)
    const rawUsername = username.trim();
    if (rawUsername !== safeUsername) {
        try {
            const res = await fetchSSO({ username: rawUsername }, 'POST');
            if (res?.loginurl) return res.loginurl;
        } catch (e: any) {
            errors.push(`Username(raw/POST): ${e.message}`);
        }
    }
  }

  const errorMessage = `SSO Unavailable. Attempts failed: ${errors.join(', ')}`;
  throw new Error(errorMessage);
};
