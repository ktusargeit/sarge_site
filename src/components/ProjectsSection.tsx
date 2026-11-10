import React, { useState, useEffect } from 'react';
import { PROJECTS_DATA as initialProjects } from '../data/mockData';
import { Project } from '../types';
import { Plane, Rocket, Shield, Cpu, Award, ArrowUpRight, CheckCircle2, ChevronRight, ChevronLeft, Layers, Image as ImageIcon, X, Sparkles, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { getCachedDoc } from '../lib/firebaseCache';
import { doc, getDoc } from 'firebase/firestore';
import { formatImageUrl, handleImageFallback } from '../lib/mediaUtils';

interface ProjectsSectionProps {
  onOpenJoinModal: () => void;
  initialProjectId?: string | null;
}

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ onOpenJoinModal, initialProjectId }) => {
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [projectsData, setProjectsData] = useState<Project[]>(initialProjects);

  // Sayfa açıldığında daima en tepeye kaydır
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // Ana sayfadan belirli bir projeye tıklandığında otomatik detayını aç
  useEffect(() => {
    if (initialProjectId && projectsData.length > 0) {
      const match = projectsData.find((p: any) => p.id === initialProjectId);
      if (match) {
        setSelectedProject(match);
      }
    }
  }, [initialProjectId, projectsData]);

  // Helper to get all unique images (cover + gallery)
  const getProjectImages = (project: any): string[] => {
    if (!project) return [];
    const list: string[] = [];
    if (project.image && typeof project.image === 'string' && project.image.trim()) {
      list.push(project.image);
    }
    if (project.gallery && Array.isArray(project.gallery)) {
      project.gallery.forEach((url: string) => {
        if (url && typeof url === 'string' && url.trim() && !list.includes(url)) {
          list.push(url);
        }
      });
    }
    return list;
  };

  const selectedImages = selectedProject ? getProjectImages(selectedProject) : [];

  // Keyboard navigation for modal & lightbox gallery
  useEffect(() => {
    if (!selectedProject) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLightboxOpen) {
          setIsLightboxOpen(false);
        } else {
          setSelectedProject(null);
        }
      } else if (e.key === 'ArrowLeft' && selectedImages.length > 1) {
        setCurrentImageIndex((prev) => (prev === 0 ? selectedImages.length - 1 : prev - 1));
      } else if (e.key === 'ArrowRight' && selectedImages.length > 1) {
        setCurrentImageIndex((prev) => (prev === selectedImages.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedProject, selectedImages.length, isLightboxOpen]);

  useEffect(() => {
    let isMounted = true;
    const fetchProjects = async () => {
      try {
        const snap = await getCachedDoc('content', 'projects_data');
        if (isMounted && snap.exists() && snap.data()?.data && Array.isArray(snap.data().data)) {
          setProjectsData(snap.data().data);
        }
      } catch (err) {
        console.warn('Could not fetch projects:', err);
      }
    };
    fetchProjects();
    return () => { isMounted = false; };
  }, []);

  return (
    <section className="py-6 sm:py-16 bg-[#09090b] text-[#E2E8F0] font-sans">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6 sm:space-y-12">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-1.5 sm:space-y-3">
          <h2 className="text-lg sm:text-3xl lg:text-4xl font-extrabold text-[#F8FAFC] tracking-tight">
            Milli Teknoloji Hamlesi İmzalı Projelerimiz
          </h2>
          <p className="text-[11px] sm:text-sm text-[#94A3B8] leading-relaxed px-1 sm:px-0">
            Mühendislik öğrencilerimizin KTÜ Atölyelerinde tamamen özgün tasarım, analiz ve imalat aşamalarından geçirdiği otonom ve havacılık sistemleri.
          </p>
        </div>

        {/* Projects Grid or Empty State */}
        {projectsData.length === 0 ? (
          <div className="text-center py-8 sm:py-16 px-3 bg-[#18181b] border border-[#27272a] rounded-xl sm:rounded-2xl max-w-xl mx-auto">
            <Rocket className="w-8 h-8 sm:w-12 sm:h-12 text-zinc-500 mx-auto mb-2.5 sm:mb-4" />
            <h3 className="text-sm sm:text-lg font-bold text-white mb-1 sm:mb-2">Henüz Proje Eklenmedi</h3>
            <p className="text-[11px] sm:text-sm text-[#94A3B8]">
              Yönetim panelinden projelerinizi ekleyip anında yayınlayabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-8">
          <AnimatePresence mode="popLayout">
            {projectsData.map((project) => {
              const projectImgs = getProjectImages(project);
              const activeCardIdx = cardImageIndices[project.id] || 0;
              const displayedImg = projectImgs[activeCardIdx] || projectImgs[0] || project.image;
              
              return (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    setCurrentImageIndex(activeCardIdx < projectImgs.length ? activeCardIdx : 0);
                    setSelectedProject(project);
                  }}
                  className="bg-[#18181b] rounded-xl sm:rounded-2xl border border-[#27272a] hover:border-[#234580] transition-all overflow-hidden flex flex-col group cursor-pointer shadow-md hover:shadow-black/50"
                >
                  <div className="relative aspect-[16/9] bg-[#000000] overflow-hidden border-b border-[#27272a]">
                    {displayedImg && displayedImg.trim() !== '' ? (
                      <img
                        src={formatImageUrl(displayedImg)}
                        alt={project.name}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        style={{ imageRendering: 'auto' }}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageFallback(e, displayedImg)}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0d0e12] text-[#475569] p-3 text-center">
                        <ImageIcon className="w-6 h-6 sm:w-10 sm:h-10 opacity-30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-transparent to-transparent opacity-70 pointer-events-none"></div>

                    {/* Multi-Photo Count Badge */}
                    {projectImgs.length > 1 && (
                      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-black/80 backdrop-blur-md px-2 sm:px-3 py-0.5 sm:py-1.5 rounded-full border border-white/20 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-white font-medium z-10 shadow-xl">
                        <ImageIcon className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 text-slate-300" />
                        <span>{activeCardIdx + 1} / {projectImgs.length}</span>
                      </div>
                    )}

                    {/* Card-level Arrow Buttons to Switch Photos Directly on the Card */}
                    {projectImgs.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardImageIndices((prev) => {
                              const curr = prev[project.id] || 0;
                              const next = curr === 0 ? projectImgs.length - 1 : curr - 1;
                              return { ...prev, [project.id]: next };
                            });
                          }}
                          className="absolute left-1.5 sm:left-2.5 top-1/2 -translate-y-1/2 p-1 sm:p-2 rounded-full bg-black/75 hover:bg-zinc-700 text-white transition-all z-20 backdrop-blur-md border border-white/20 shadow-xl hover:scale-110 active:scale-95"
                          title="Önceki Fotoğraf"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardImageIndices((prev) => {
                              const curr = prev[project.id] || 0;
                              const next = (curr + 1) % projectImgs.length;
                              return { ...prev, [project.id]: next };
                            });
                          }}
                          className="absolute right-1.5 sm:right-2.5 top-1/2 -translate-y-1/2 p-1 sm:p-2 rounded-full bg-black/75 hover:bg-zinc-700 text-white transition-all z-20 backdrop-blur-md border border-white/20 shadow-xl hover:scale-110 active:scale-95"
                          title="Sonraki Fotoğraf"
                        >
                          <ChevronRight className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                        </button>

                        {/* Dot indicators on card */}
                        <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 z-20 bg-black/70 px-1.5 py-0.5 rounded-full backdrop-blur-sm border border-white/10">
                          {projectImgs.map((_, dotIdx) => (
                            <button
                              key={dotIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardImageIndices((prev) => ({ ...prev, [project.id]: dotIdx }));
                              }}
                              className={`h-1 rounded-full transition-all ${dotIdx === activeCardIdx ? 'bg-white w-2.5 sm:w-3.5' : 'bg-white/40 w-1 sm:w-1.5 hover:bg-white/70'}`}
                              title={`Fotoğraf ${dotIdx + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="p-3.5 sm:p-6 space-y-1.5 sm:space-y-3">
                    {project.categoryLabel && (
                      <span className="text-[9px] sm:text-[11px] text-slate-400 font-sans font-semibold uppercase tracking-wider block">
                        {project.categoryLabel}
                      </span>
                    )}
                    <h3 className="text-sm sm:text-xl font-bold text-white font-sans group-hover:text-slate-100 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-[11px] sm:text-sm text-[#94A3B8] line-clamp-2 sm:line-clamp-3 leading-relaxed">
                      {project.shortDesc || project.fullDesc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        )}

      </div>
    
      {/* DETAILED PROJECT MODAL VIEW (Mobile-Optimized & Sleek) */}
      <AnimatePresence>
        {selectedProject && (
          <div 
            onClick={() => setSelectedProject(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl bg-[#141417] rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]"
            >
              {/* Modal Top Sticky Header */}
              <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-[#18181c] border-b border-zinc-800 shrink-0 z-20">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-blue-600/20 text-blue-400 border border-blue-500/30 shrink-0">
                    {selectedProject.categoryLabel || 'PROJE'}
                  </span>
                  {selectedProject.code && (
                    <span className="text-[10px] sm:text-xs font-mono text-zinc-400 truncate">
                      {selectedProject.code}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {selectedImages.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => setIsLightboxOpen(true)} 
                      className="p-1.5 sm:p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors border border-zinc-700"
                      title="Tam Ekran Görüntüle"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setSelectedProject(null)} 
                    className="p-1.5 sm:p-2 bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 text-zinc-300 rounded-lg transition-colors border border-zinc-700"
                    title="Kapat (ESC)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Body: Image + Info */}
              <div className="overflow-y-auto flex-1 divide-y divide-zinc-800/80">
                
                {/* Hero Media Stage */}
                <div className="relative aspect-[16/10] sm:aspect-[16/9] max-h-[360px] sm:max-h-[460px] w-full bg-[#08080a] overflow-hidden flex items-center justify-center">
                  {selectedImages.length > 0 ? (
                    <>
                      {/* Blurred backdrop glow */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 blur-2xl scale-110">
                        <img 
                          src={formatImageUrl(selectedImages[currentImageIndex])} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          onError={(e) => handleImageFallback(e, selectedImages[currentImageIndex])}
                        />
                      </div>
                      
                      {/* Main Center Image */}
                      <img 
                        src={formatImageUrl(selectedImages[currentImageIndex])} 
                        alt={selectedProject.name} 
                        onClick={() => setIsLightboxOpen(true)}
                        className="relative max-w-full max-h-full object-contain z-10 drop-shadow-xl cursor-zoom-in p-1 sm:p-3" 
                        style={{ imageRendering: 'auto' }}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImageFallback(e, selectedImages[currentImageIndex])}
                      />

                      {/* Photo Counter Pill */}
                      {selectedImages.length > 1 && (
                        <div className="absolute top-2.5 left-2.5 z-20 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium text-white border border-white/10 flex items-center gap-1.5 shadow-lg">
                          <ImageIcon className="w-3 h-3 text-zinc-300" />
                          <span>{currentImageIndex + 1} / {selectedImages.length}</span>
                        </div>
                      )}

                      {/* Navigation Arrows for Multi-image */}
                      {selectedImages.length > 1 && (
                        <>
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setCurrentImageIndex((prev) => (prev === 0 ? selectedImages.length - 1 : prev - 1)); 
                            }}
                            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-black/75 hover:bg-zinc-800 text-white rounded-full transition-all z-20 backdrop-blur-md border border-white/10 hover:scale-105 active:scale-95"
                            title="Önceki Fotoğraf"
                          >
                            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setCurrentImageIndex((prev) => (prev === selectedImages.length - 1 ? 0 : prev + 1)); 
                            }}
                            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-3 bg-black/75 hover:bg-zinc-800 text-white rounded-full transition-all z-20 backdrop-blur-md border border-white/10 hover:scale-105 active:scale-95"
                            title="Sonraki Fotoğraf"
                          >
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 p-4 text-center">
                      <ImageIcon className="w-8 h-8 sm:w-12 sm:h-12 mb-2 text-zinc-600" />
                      <span className="text-xs sm:text-sm font-medium">Fotoğraf Bulunmuyor</span>
                    </div>
                  )}
                </div>

                {/* Project Details Section */}
                <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                  
                  {/* Title & Key Highlight Badges */}
                  <div className="space-y-2">
                    <h2 className="text-base sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight">
                      {selectedProject.name}
                    </h2>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-0.5">
                      {selectedProject.status && (
                        <span className="px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold bg-zinc-800 text-zinc-200 border border-zinc-700">
                          {selectedProject.status}
                        </span>
                      )}
                      {(selectedProject.achievement || selectedProject.featured) && (
                        <span className="px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{selectedProject.achievement || selectedProject.featured}</span>
                        </span>
                      )}
                      {selectedProject.competition && (
                        <span className="px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          {selectedProject.competition}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Project Summary / About */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <h3 className="text-xs sm:text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-zinc-400" /> Proje Hakkında
                    </h3>
                    <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-[11px] sm:text-sm bg-[#18181c] p-3 sm:p-4 rounded-xl border border-zinc-800">
                      {selectedProject.fullDesc || selectedProject.shortDesc}
                    </p>
                  </div>

                  {/* Project Story (if present) */}
                  {selectedProject.story && (
                    <div className="space-y-1.5 sm:space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" /> Geliştirme Hikayesi
                      </h3>
                      <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap text-[11px] sm:text-sm italic bg-amber-500/5 p-3 sm:p-4 rounded-xl border border-amber-500/20">
                        {selectedProject.story}
                      </p>
                    </div>
                  )}

                  {/* Two-Column Info Cards (Specs & General Info) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {/* General Info Card */}
                    <div className="bg-[#18181c] rounded-xl border border-zinc-800 p-3 sm:p-4 space-y-2.5">
                      <h3 className="text-zinc-200 font-bold text-xs sm:text-sm border-b border-zinc-800 pb-1.5">
                        Proje Bilgileri
                      </h3>
                      <div className="space-y-2 text-[11px] sm:text-xs">
                        {selectedProject.categoryLabel && (
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-zinc-400 shrink-0">Kategori:</span>
                            <span className="text-zinc-200 font-semibold text-right">{selectedProject.categoryLabel}</span>
                          </div>
                        )}
                        {selectedProject.code && (
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-zinc-400 shrink-0">Kod / Yıl:</span>
                            <span className="text-zinc-200 font-semibold text-right">{selectedProject.code}</span>
                          </div>
                        )}
                        {selectedProject.competition && (
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-zinc-400 shrink-0">Yarışma:</span>
                            <span className="text-blue-300 font-semibold text-right">{selectedProject.competition}</span>
                          </div>
                        )}
                        {selectedProject.status && (
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-zinc-400 shrink-0">Durum:</span>
                            <span className="text-zinc-200 font-semibold text-right">{selectedProject.status}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Technical Specs Card */}
                    {selectedProject.specs && selectedProject.specs.length > 0 && (
                      <div className="bg-[#18181c] rounded-xl border border-zinc-800 p-3 sm:p-4 space-y-2.5">
                        <h3 className="text-zinc-200 font-bold text-xs sm:text-sm border-b border-zinc-800 pb-1.5">
                          Teknik Özellikler
                        </h3>
                        <div className="space-y-2 text-[11px] sm:text-xs">
                          {selectedProject.specs.map((spec: any, i: number) => (
                            <div key={i} className="flex justify-between items-start gap-2">
                              <span className="text-zinc-400 shrink-0">{spec.label || `Özellik ${i+1}`}:</span>
                              <span className="text-zinc-100 font-bold text-right break-words">{spec.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Thumbnail Gallery (if multiple images) */}
                  {selectedImages.length > 1 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs sm:text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                          Fotoğraflar ({selectedImages.length})
                        </h3>
                        <span className="text-[10px] sm:text-xs text-zinc-500">
                          Seçmek için tıklayın
                        </span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {selectedImages.map((gImg, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setCurrentImageIndex(idx)}
                            className={`aspect-video rounded-lg overflow-hidden bg-black border transition-all relative ${idx === currentImageIndex ? 'border-blue-500 ring-2 ring-blue-500/50 scale-[1.02]' : 'border-zinc-800 opacity-70 hover:opacity-100'}`}
                          >
                            <img
                              src={formatImageUrl(gImg)}
                              alt={`Fotoğraf ${idx + 1}`}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => handleImageFallback(e, gImg)}
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bottom Action Buttons */}
                  <div className="pt-2 flex items-center justify-between gap-3 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProject(null);
                        onOpenJoinModal();
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <span>Topluluğa Katıl</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedProject(null)}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Kapat
                    </button>
                  </div>

                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen HD Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && selectedImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsLightboxOpen(false)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 select-none"
          >
            {/* Top Toolbar */}
            <div className="absolute top-3 left-3 right-3 sm:top-4 sm:left-6 sm:right-6 flex items-center justify-between z-20 pointer-events-none">
              <div className="bg-black/80 border border-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm text-white font-medium flex items-center gap-2 pointer-events-auto shadow-2xl">
                <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-300" />
                <span className="truncate max-w-[200px] sm:max-w-none">{selectedProject?.name} ({currentImageIndex + 1}/{selectedImages.length})</span>
              </div>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 sm:p-3 bg-black/80 hover:bg-zinc-700 text-white rounded-full transition-all pointer-events-auto shadow-2xl border border-white/10 hover:scale-105"
                title="Kapat (ESC)"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Previous Image Arrow */}
            {selectedImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev === 0 ? selectedImages.length - 1 : prev - 1));
                }}
                className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-4 bg-black/80 hover:bg-zinc-700 text-white rounded-full transition-all z-20 backdrop-blur-md shadow-2xl border border-white/20 hover:scale-110 active:scale-95"
                title="Önceki Fotoğraf"
              >
                <ChevronLeft className="w-5 h-5 sm:w-8 sm:h-8" />
              </button>
            )}

            {/* Next Image Arrow */}
            {selectedImages.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev === selectedImages.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2.5 sm:p-4 bg-black/80 hover:bg-zinc-700 text-white rounded-full transition-all z-20 backdrop-blur-md shadow-2xl border border-white/20 hover:scale-110 active:scale-95"
                title="Sonraki Fotoğraf"
              >
                <ChevronRight className="w-5 h-5 sm:w-8 sm:h-8" />
              </button>
            )}

            {/* Full Ultra-HD Image */}
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="max-w-[96vw] max-h-[82vh] flex items-center justify-center p-1"
            >
              <img
                src={formatImageUrl(selectedImages[currentImageIndex])}
                alt={selectedProject?.name || "Fotoğraf"}
                className="max-w-full max-h-[82vh] object-contain rounded-lg shadow-2xl transition-all duration-300"
                style={{ imageRendering: 'auto' }}
                referrerPolicy="no-referrer"
                onError={(e) => handleImageFallback(e, selectedImages[currentImageIndex])}
              />
            </div>

            {/* Bottom Keyboard Hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/75 px-4 py-1.5 rounded-full border border-white/10 text-[11px] sm:text-xs text-slate-300 pointer-events-none hidden sm:flex items-center gap-2 shadow-2xl">
              <span>Fotoğraflar için <strong>← Sol</strong> / <strong>Sağ →</strong> ok tuşları</span>
              <span className="text-slate-500">&bull;</span>
              <span>Çıkış: <strong>ESC</strong></span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};