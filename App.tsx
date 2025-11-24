import React, { useState, useEffect } from 'react';
import { MoodleCourse, MoodleUser, UserSession } from './types';
import * as moodleService from './services/moodleService';
import { MOODLE_CONFIG } from './constants';

// --- SVG Icons ---
const Icons = {
  Home: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Users: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Book: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  Plus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  Loader: () => <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
};

type View = 'courses' | 'my_courses' | 'users' | 'create_course' | 'create_user';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [currentView, setCurrentView] = useState<View>('courses');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Data States
  const [courses, setCourses] = useState<MoodleCourse[]>([]);
  const [userCourses, setUserCourses] = useState<MoodleCourse[]>([]);
  const [users, setUsers] = useState<MoodleUser[]>([]);

  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  useEffect(() => {
    const storedSession = localStorage.getItem('moodle_marketing_session');
    if (storedSession) {
      setSession(JSON.parse(storedSession));
    }
  }, []);

  useEffect(() => {
    if (session) {
      // Clear errors when switching views
      setError(null);
      if (currentView === 'courses') loadCourses();
      if (currentView === 'my_courses') loadUserCourses();
      if (currentView === 'users') loadUsers();
    }
  }, [session, currentView]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  // Safe helper for strings
  const getInitial = (str: any) => {
    if (typeof str === 'string' && str.length > 0) return str[0].toUpperCase();
    return '';
  };

  // --- Actions ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (!loginPassword) {
        throw new Error("Password is required.");
      }

      const cleanUsername = loginUsername.trim();

      // Note: In a real app, verify password hash via backend. 
      // Here we assume existence check + password presence is enough for this demo.
      const user = await moodleService.getUserByField('username', cleanUsername);
      
      if (user) {
        if (user.auth === 'nologin' || (user as any).suspended) {
             throw new Error("This account is suspended or disabled in Moodle.");
        }
        
        const newSession: UserSession = {
          id: user.id,
          username: user.username,
          fullname: user.fullname,
          email: user.email,
          isAuthenticated: true,
          profileImage: user.profileimageurlsmall,
          firstname: user.firstname,
          lastname: user.lastname,
          password: loginPassword // Store password for direct form login fallback
        };
        setSession(newSession);
        localStorage.setItem('moodle_marketing_session', JSON.stringify(newSession));
        setLoginUsername('');
        setLoginPassword('');
        
        // Eagerly load user courses to help with redirection logic later
        moodleService.getUserCourses(user.id).then(data => {
            if (Array.isArray(data)) setUserCourses(data);
        }).catch(err => console.warn("Background load of user courses failed:", err));

      } else {
        setError("User not found in Moodle. Please check your username.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('moodle_marketing_session');
    setCourses([]);
    setUserCourses([]);
    setUsers([]);
    setError(null);
  };

  const loadCourses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await moodleService.getCourses();
      if (Array.isArray(data)) {
        setCourses(data.filter(c => c.format !== 'site'));
      } else {
        setCourses([]);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load available courses: " + err.message);
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserCourses = async () => {
    if (!session) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await moodleService.getUserCourses(session.id);
      if (Array.isArray(data)) {
        setUserCourses(data);
      } else {
        setUserCourses([]);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load your enrolled courses: " + err.message);
      setUserCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await moodleService.getUsers();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load users: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Helper function to perform a direct POST login to Moodle
   * This is used as a fallback when API SSO fails.
   */
  const performDirectLogin = (targetUrl: string) => {
    if (!session || !session.password) return false;

    try {
      // Create a form element dynamically
      const form = document.createElement('form');
      form.method = 'POST';
      
      // FIX: Pass wantsurl in the query string of the action URL
      // This ensures it persists even if Moodle's CSRF protection blocks the auto-POST
      const loginActionUrl = `${MOODLE_CONFIG.URL.replace(/\/$/, '')}/login/index.php?wantsurl=${encodeURIComponent(targetUrl)}`;
      form.action = loginActionUrl;
      
      // Use self to prevent popup blocking and ensure same-tab navigation
      form.target = '_self'; 
      form.style.display = 'none';

      const uInput = document.createElement('input');
      uInput.type = 'hidden';
      uInput.name = 'username';
      uInput.value = session.username;
      form.appendChild(uInput);

      const pInput = document.createElement('input');
      pInput.type = 'hidden';
      pInput.name = 'password';
      pInput.value = session.password;
      form.appendChild(pInput);

      document.body.appendChild(form);
      console.log(`[Direct Login] Submitting form to ${loginActionUrl} for user ${session.username}`);
      form.submit();
      return true;
    } catch (e) {
      console.error("Direct Login Form generation failed:", e);
      return false;
    }
  };

  /**
   * SSO Handler
   * Generates a login URL via API (auth_userkey_request_login_url).
   * Appends 'wantsurl' to redirect user to specific Course or Dashboard.
   */
  const handleSSOClick = async (courseId?: number) => {
    if (!session) return;
    setIsLoading(true);
    // Do not clear general error here, maybe user wants to see it? 
    // But usually we should clear previous operation errors.
    setError(null);

    // 1. Determine destination URL
    const baseUrl = MOODLE_CONFIG.URL.replace(/\/$/, '');
    let targetPath = '/my/'; // Default to Dashboard

    if (courseId) {
      targetPath = `/course/view.php?id=${courseId}`;
    }

    const fullTargetUrl = `${baseUrl}${targetPath}`;

    console.log(`[SSO] Initiating. Target: ${fullTargetUrl}`);
    showNotification("Initiating Moodle Login...");

    try {
      // 2. Try API SSO
      const ssoBaseUrl = await moodleService.getSSOLoginUrl(
        session.id,
        session.username,
        session.email
      );

      // 3. Construct Final URL with wantsurl
      // Moodle's login/index.php (or key login) accepts 'wantsurl' to redirect after login
      const separator = ssoBaseUrl.includes('?') ? '&' : '?';
      const finalSsoUrl = `${ssoBaseUrl}${separator}wantsurl=${encodeURIComponent(fullTargetUrl)}`;

      console.log(`[SSO] Success. Redirecting to: ${finalSsoUrl}`);
      window.location.href = finalSsoUrl;

    } catch (error: any) {
      // 4. API Failed: Show Notification and fallback
      console.warn(`[SSO] API Failed (${error.message}). Attempting Direct Login fallback...`);
      showNotification(`SSO API Warning: ${error.message}. Attempting automatic direct login...`);

      // 5. Fallback: Direct Form Post
      // We pass the fullTargetUrl so the form action can include it as ?wantsurl=...
      const success = performDirectLogin(fullTargetUrl);
      if (!success) {
         // 6. Last Resort: Link to page (User logs in manually)
         // Show error before redirecting
         setError("Automatic login failed completely. Redirecting you to Moodle login page...");
         setTimeout(() => {
             window.location.href = fullTargetUrl;
         }, 5000);
      }
    } finally {
      // Keep loading spinner if we are redirecting
      // setIsLoading(false); 
      // Actually we should turn off loading if we failed and are showing error, 
      // but if we redirect, it doesn't matter. 
      // Safe to turn off after short delay or if fallback fails.
      setTimeout(() => setIsLoading(false), 5000);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await moodleService.createCourse({
        fullname: formData.get('fullname') as string,
        shortname: formData.get('shortname') as string,
        categoryid: 1, // Default category
        summary: formData.get('summary') as string,
      });
      showNotification("Course created successfully!");
      setCurrentView('courses');
      loadCourses();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await moodleService.createUser({
        username: formData.get('username') as string,
        password: formData.get('password') as string,
        firstname: formData.get('firstname') as string,
        lastname: formData.get('lastname') as string,
        email: formData.get('email') as string,
      });
      showNotification("User created successfully!");
      setCurrentView('users');
      loadUsers();
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('nopermissions')) {
          setError("Access Denied: Your Moodle API Token is missing the 'moodle/user:create' capability. Please contact your Moodle Administrator to enable this permission.");
      } else {
          setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- Views ---

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">OPTIMUS Marketing Portal</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Sign in to manage courses and users</p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
                <div className="mt-1">
                  <input id="username" name="username" type="text" required 
                    value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <div className="mt-1">
                  <input id="password" name="password" type="password" required 
                    value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
                </div>
              </div>

              {error && <div className="text-red-600 text-sm">{error}</div>}

              <div>
                <button type="submit" disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50">
                  {isLoading ? <Icons.Loader /> : "Sign in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="flex items-center justify-center h-16 border-b">
          <span className="text-xl font-bold text-primary-600">OPTIMUS Portal</span>
        </div>
        <div className="p-4 border-b">
           <div className="flex items-center space-x-3">
              {session.profileImage ? (
                <img src={session.profileImage} alt="Profile" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                  {getInitial(session.firstname) + getInitial(session.lastname)}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">{session.fullname}</p>
                <p className="text-xs text-gray-500 truncate w-32">{session.email}</p>
              </div>
           </div>
        </div>
        <nav className="mt-6">
          <button onClick={() => setCurrentView('courses')} className={`flex items-center w-full px-6 py-3 ${currentView === 'courses' ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Icons.Book /> <span className="mx-3">All Courses</span>
          </button>
          <button onClick={() => setCurrentView('my_courses')} className={`flex items-center w-full px-6 py-3 ${currentView === 'my_courses' ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Icons.Home /> <span className="mx-3">My Courses</span>
          </button>
          <button onClick={() => setCurrentView('users')} className={`flex items-center w-full px-6 py-3 ${currentView === 'users' ? 'bg-primary-50 text-primary-700 border-r-4 border-primary-600' : 'text-gray-600 hover:bg-gray-50'}`}>
            <Icons.Users /> <span className="mx-3">Users</span>
          </button>
          <button onClick={handleLogout} className="flex items-center w-full px-6 py-3 text-gray-600 hover:bg-gray-50 mt-auto">
            <Icons.Logout /> <span className="mx-3">Logout</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white shadow h-16 flex items-center justify-between px-6">
          <h1 className="text-2xl font-bold text-gray-800 capitalize">{currentView.replace('_', ' ')}</h1>
          <div className="flex space-x-4">
            <button onClick={() => handleSSOClick()} className="text-sm text-primary-600 hover:text-primary-800 font-medium">
              Go to Moodle Dashboard &rarr;
            </button>
            {(currentView === 'courses' || currentView === 'create_course') && (
              <button onClick={() => setCurrentView('create_course')} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center">
                <Icons.Plus /> <span className="ml-2">New Course</span>
              </button>
            )}
            {(currentView === 'users' || currentView === 'create_user') && (
              <button onClick={() => setCurrentView('create_user')} className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700 flex items-center">
                <Icons.Plus /> <span className="ml-2">New User</span>
              </button>
            )}
          </div>
        </header>

        <main className="p-6">
          {notification && (
            <div className="mb-4 p-4 rounded-md bg-green-50 text-green-700 border border-green-200 shadow-sm">
              {notification}
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-4 rounded-md bg-red-50 text-red-700 border border-red-200 shadow-sm">
              {error}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-10">
              <Icons.Loader />
            </div>
          )}

          {/* COURSE LIST VIEW (ALL) */}
          {currentView === 'courses' && !isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.length === 0 ? (
                  <div className="col-span-3 text-center py-10 text-gray-500">
                      No courses found. 
                      <br/><button onClick={loadCourses} className="mt-2 text-primary-600 underline">Retry</button>
                  </div>
              ) : (
                courses.map(course => (
                    <div key={course.id} className="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer border border-gray-200" 
                        onClick={() => handleSSOClick(course.id)}>
                    <div className="h-32 bg-gray-200 rounded-t-lg relative overflow-hidden">
                        {course.courseimage ? (
                            <img src={course.courseimage} alt={course.fullname} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary-100 text-primary-500">
                            <Icons.Book />
                            </div>
                        )}
                    </div>
                    <div className="p-4">
                        <h3 className="text-lg font-bold text-gray-900 truncate">{course.fullname}</h3>
                        <p className="text-sm text-gray-500 mb-2">{course.shortname}</p>
                        <div className="text-sm text-gray-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: course.summary || 'No description.' }}></div>
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                            <span className="text-xs text-gray-400">ID: {course.id}</span>
                            <span className="text-primary-600 text-sm font-medium hover:underline">Open in Moodle &rarr;</span>
                        </div>
                    </div>
                    </div>
                ))
              )}
            </div>
          )}

          {/* MY COURSES VIEW */}
          {currentView === 'my_courses' && !isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userCourses.length === 0 ? (
                  <div className="col-span-3 text-center py-10 text-gray-500">
                      You are not enrolled in any courses yet.
                      <br/><button onClick={loadUserCourses} className="mt-2 text-primary-600 underline">Refresh</button>
                  </div>
              ) : (
                userCourses.map(course => (
                    <div key={course.id} className="bg-white rounded-lg shadow hover:shadow-md transition cursor-pointer border border-gray-200" 
                        onClick={() => handleSSOClick(course.id)}>
                    <div className="h-32 bg-gray-200 rounded-t-lg relative overflow-hidden">
                        {course.courseimage ? (
                            <img src={course.courseimage} alt={course.fullname} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-green-100 text-green-500">
                            <Icons.Book />
                            </div>
                        )}
                    </div>
                    <div className="p-4">
                        <h3 className="text-lg font-bold text-gray-900 truncate">{course.fullname}</h3>
                        <span className="inline-block px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full mb-2">Enrolled</span>
                        <div className="text-sm text-gray-600 line-clamp-2" dangerouslySetInnerHTML={{ __html: course.summary || 'No description.' }}></div>
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                            <span className="text-xs text-gray-400">ID: {course.id}</span>
                            <span className="text-primary-600 text-sm font-medium hover:underline">Resume Course &rarr;</span>
                        </div>
                    </div>
                    </div>
                ))
              )}
            </div>
          )}

          {/* USERS LIST VIEW */}
          {currentView === 'users' && !isLoading && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {users.length === 0 ? (
                   <li className="p-4 text-center text-gray-500">No users found.</li>
                ) : (
                  users.map(user => (
                    <li key={user.id} className="px-6 py-4 flex items-center hover:bg-gray-50">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                        {getInitial(user.firstname)}{getInitial(user.lastname)}
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="text-sm font-medium text-gray-900">{user.fullname}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.username} (ID: {user.id})
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {/* CREATE COURSE FORM */}
          {currentView === 'create_course' && (
            <div className="max-w-2xl mx-auto bg-white shadow sm:rounded-lg p-6">
              <form onSubmit={handleCreateCourse} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Course Full Name</label>
                  <input type="text" name="fullname" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Short Name</label>
                  <input type="text" name="shortname" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Summary</label>
                  <textarea name="summary" rows={3} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"></textarea>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setCurrentView('courses')} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 mr-3">Cancel</button>
                  <button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">Create Course</button>
                </div>
              </form>
            </div>
          )}

          {/* CREATE USER FORM */}
          {currentView === 'create_user' && (
            <div className="max-w-2xl mx-auto bg-white shadow sm:rounded-lg p-6">
              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input type="text" name="firstname" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input type="text" name="lastname" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input type="text" name="username" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" name="email" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input type="password" name="password" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500" />
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setCurrentView('users')} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 mr-3">Cancel</button>
                  <button type="submit" disabled={isLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">Create User</button>
                </div>
              </form>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default App;
