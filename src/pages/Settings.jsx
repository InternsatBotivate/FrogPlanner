import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

export default function Settings() {
  const { user, updateProfile } = useAuthStore();
  
  // State for form fields
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.full_name || '');
      setPassword(user.password_hash || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setDesignation(user.designation || '');
      setDepartment(user.department || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();

    if (!name.trim() || !password.trim()) {
      toast.error('Name and password are required fields.');
      return;
    }

    const updatedData = {
      name: name.trim(),
      password: password.trim(),
      email: email.trim(),
      phone: phone.trim(),
      designation: designation.trim(),
      department: department.trim(),
      bio: bio.trim()
    };

    const { error } = await updateProfile(updatedData);

    if (error) {
      console.error(error);
      toast.error(error.message || 'Failed to update profile details.');
    } else {
      toast.success('Professional profile details updated successfully!');
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please log in to edit your profile.
      </div>
    );
  }

  return (
    <div className="p-0 sm:p-2 md:p-6 flex flex-col h-full min-h-0 overflow-y-auto space-y-6">
      
      <form onSubmit={handleSave} className="space-y-6 w-full">
        
        {/* Banner with Profile Info (White Card style) */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-500 text-white flex items-center justify-center font-bold text-3xl shadow-md border-4 border-white">
              {name ? name.charAt(0).toUpperCase() : user.id.charAt(0).toUpperCase()}
            </div>
            <span className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full" title="Active Session"></span>
          </div>

          <div className="flex-1 text-center md:text-left space-y-1">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800">{name || 'User Profile'}</h2>
            </div>
            <p className="text-xs text-gray-600 font-semibold">{designation || 'Specialist'} • {department || 'General Division'}</p>
            <p className="text-[11px] text-gray-400">Account ID: <span className="font-semibold text-gray-600">{user.id}</span></p>
          </div>
        </div>

        {/* Form Sections (Standalone Cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          
          {/* Left Column: Account Credentials (White Card) */}
          <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-gray-800 border-b border-gray-100 pb-2 uppercase tracking-wide">Account Security</h3>
            
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight">User ID / Username</label>
              <input 
                type="text" 
                value={user.username || user.id} 
                disabled 
                className="w-full border border-gray-200 bg-gray-50 rounded px-2.5 py-1.5 focus:outline-none text-[11px] font-medium text-gray-400 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight">Full Name *</label>
              <input 
                type="text" 
                required
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium text-gray-700 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight">Account Password *</label>
              <input 
                type="text" 
                required
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium text-gray-700 bg-white"
              />
            </div>
          </div>

          {/* Right Column: Personal & Professional Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Contact & Personal Info card (White Card) */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-bold text-gray-800 border-b border-gray-100 pb-2 uppercase tracking-wide">Personal Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight">Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="example@domain.com"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium text-gray-700 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight">Contact Phone</label>
                  <input 
                    type="tel" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="+91 XXXXX XXXXX"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium text-gray-700 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight">Designation / Title</label>
                  <input 
                    type="text" 
                    value={designation} 
                    onChange={(e) => setDesignation(e.target.value)} 
                    placeholder="e.g. Chief Executive Officer"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium text-gray-700 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight">Department / Division</label>
                  <input 
                    type="text" 
                    value={department} 
                    onChange={(e) => setDepartment(e.target.value)} 
                    placeholder="e.g. Executive Board"
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium text-gray-700 bg-white"
                  />
                </div>
              </div>

              {/* Bio / Description */}
              <div className="space-y-1 pt-1">
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-tight">Professional Bio / About</label>
                <textarea 
                  rows={3}
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  placeholder="Describe your role or personal mission..."
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-medium text-gray-700 bg-white"
                />
              </div>
            </div>

            {/* Save Action Buttons */}
            <div className="flex justify-end gap-3">
              <button 
                type="submit"
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-md active:scale-95 flex items-center justify-center"
              >
                Save Profile
              </button>
            </div>

          </div>

        </div>

      </form>
    </div>
  );
}
