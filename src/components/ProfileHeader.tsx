import React from 'react';
import { User as UserIcon, Camera } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LazyImage from './LazyImage';

interface ProfileHeaderProps {
  user: any;
  isEditing: boolean;
  editName: string;
  setEditName: (name: string) => void;
  editPhone: string;
  editAvatar: string;
  setEditAvatar: (avatar: string) => void;
  error: string | null;
  updateLoading: boolean;
  handleUpdateProfile: () => void;
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsEditing: (isEditing: boolean) => void;
  setError: (error: string | null) => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  isEditing,
  editName,
  setEditName,
  editPhone,
  editAvatar,
  setEditAvatar,
  error,
  updateLoading,
  handleUpdateProfile,
  handleImageChange,
  setIsEditing,
  setError
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center pt-safe pb-6 px-4 bg-surface-light dark:bg-surface-dark mb-4 shadow-sm border-b border-slate-100 dark:border-slate-800">
      <div className="relative mb-4 group cursor-pointer">
        <div 
          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-24 w-24 border-4 border-slate-50 dark:border-slate-700 shadow-sm transition-transform group-hover:scale-105 flex items-center justify-center bg-slate-100 dark:bg-slate-800 overflow-hidden"
        >
          {editAvatar || user?.avatar ? (
            <LazyImage src={editAvatar || user?.avatar} alt={user?.name} className="h-full w-full object-cover" isThumbnail={false} />
          ) : (
            <UserIcon size={48} className="text-slate-400" />
          )}
        </div>
        {isEditing && (
          <label className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5 border-2 border-white dark:border-surface-dark flex items-center justify-center shadow-md cursor-pointer">
            <Camera size={16} className="text-white" />
            <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
          </label>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-3 w-full max-w-[280px]">
          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-right"
            placeholder={t('profile.full_name')}
          />
          <input
            type="tel"
            value={editPhone}
            disabled
            className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 dark:text-slate-500 cursor-not-allowed text-right"
            placeholder={t('profile.phone')}
            dir="ltr"
          />
          <div className="flex gap-2">
            <button 
              onClick={handleUpdateProfile}
              disabled={updateLoading}
              className="flex-1 bg-primary text-white rounded-lg h-9 text-xs font-bold hover:bg-blue-600 disabled:opacity-50"
            >
              {updateLoading ? t('profile.saving') : t('profile.save')}
            </button>
            <button 
              onClick={() => {
                setIsEditing(false);
                setEditName(user?.name || '');
                setEditAvatar(user?.avatar || '');
                setError(null);
              }}
              className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg h-9 text-xs font-bold"
            >
              {t('profile.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{user?.name}</h3>
            <button 
              onClick={() => setIsEditing(true)}
              className="p-1 text-slate-400 hover:text-primary transition-colors"
            >
              <Camera size={16} />
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 dir-ltr">{user?.phone}</p>
        </div>
      )}
    </div>
  );
};

export default ProfileHeader;
