"use client";

import React, { useEffect, useState } from "react";
import { UserCircle } from "@phosphor-icons/react";

interface UserAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({
  name,
  imageUrl,
  size = 40,
  className = "",
  fallbackClassName = "",
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  if (!imageUrl || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-slate-100 text-slate-400 ${fallbackClassName}`}
        style={{ width: size, height: size }}
        aria-label={`${name} avatar placeholder`}
      >
        <UserCircle size={size} weight="fill" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`${name} profile`}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
