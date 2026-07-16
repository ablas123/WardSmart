/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, User, getRoleColor, getRoleLabel } from '../types';
import { MessageSquare, Send, Users, Sparkles, Clock, CircleDot } from 'lucide-react';
import { motion } from 'motion/react';

interface TeamChatProps {
  chatMessages: ChatMessage[];
  teamMembers: User[];
  currentUser: User;
  onSendMessage: (text: string) => void;
  lang?: any;
}

export default function TeamChat({ chatMessages, teamMembers, currentUser, onSendMessage, lang }: TeamChatProps) {
  const [text, setText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">
      
      {/* Left side: Team Members List (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col h-full">
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-4.5 h-4.5 text-blue-600" />
          {lang === 'en' ? `Medical Staff on Duty (${teamMembers.filter(m => !m.archived && !m.disabled).length})` : `الطاقم الطبي المناوب (${teamMembers.filter(m => !m.archived && !m.disabled).length})`}
        </h2>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {teamMembers
            .filter(member => !member.archived && !member.disabled)
            .map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                      {member.name.substring(3, 5).trim() || member.name[0]}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800 block">{member.name}</span>
                    <span className="text-[9px] text-slate-400 block">{member.email}</span>
                  </div>
                </div>

                <span className={`text-[8px] font-bold px-2 py-0.5 rounded-lg border ${getRoleColor(member.role)}`}>
                  {getRoleLabel(member.role, lang).split(' ')[0]}
                </span>
              </div>
            ))}
        </div>

        <div className="text-[9px] text-slate-400 border-t border-slate-100 pt-3 mt-4 flex items-center gap-1 font-semibold">
          <CircleDot className="w-3 h-3 text-green-500 animate-pulse" />
          <span>قنوات الاتصال المشفّرة سريرياً بالجناح</span>
        </div>
      </div>

      {/* Right side: Chat Board (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-xs flex flex-col h-full overflow-hidden">
        
        {/* Chat Title */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-xs font-bold text-slate-800">قناة التنسيق الداخلي والمناداة العاجلة</h2>
              <span className="text-[10px] text-slate-400 block mt-0.5">تواصل فوري متزامن بين أخصائيين وأطباء الامتياز المناوبين.</span>
            </div>
          </div>
          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-lg">قناة الجناح العام</span>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
          {chatMessages.length === 0 ? (
            <div className="text-center py-20 text-slate-400 text-xs">
              لا توجد رسائل سابقة. ابدأ المحادثة بالتنسيق الطبي مع الطاقم! 💬
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isMe = msg.senderName === currentUser.name;
              return (
                <div 
                  key={msg.id}
                  className={`flex gap-3 max-w-lg ${isMe ? 'mr-auto flex-row-reverse' : 'ml-auto'}`}
                >
                  {/* Sender Avatar */}
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-300">
                    {msg.senderName.substring(3, 5).trim() || msg.senderName[0]}
                  </div>

                  <div className="space-y-1">
                    {/* Sender details */}
                    <div className={`flex items-center gap-1.5 text-[9px] text-slate-400 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <span className="font-bold text-slate-600">{msg.senderName}</span>
                      <span className="bg-slate-100 text-slate-500 rounded px-1 text-[8px] font-bold">{msg.senderRole}</span>
                      <span className="text-[8px] flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {new Date(msg.timestamp).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>

                    {/* Chat Bubble */}
                    <div className={`p-3 rounded-2xl text-xs font-semibold leading-relaxed ${
                      isMe 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-150 rounded-tl-none shadow-3xs'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-100 bg-white flex gap-2">
          <input 
            type="text" 
            placeholder="اكتب رسالتك التنسيقية هنا..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <button 
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1 shadow-xs"
          >
            <Send className="w-4 h-4 transform rotate-180" />
            إرسال
          </button>
        </form>

      </div>

    </div>
  );
}
