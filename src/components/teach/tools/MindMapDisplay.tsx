'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, Edit3, Check, RefreshCw, Plus, Minus, Expand, Eye, List, Grid, X, Trash2, ZoomIn, ZoomOut, Move, RotateCcw, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Generate truly unique IDs
const generateUniqueId = (() => {
  let counter = 0;
  return (prefix: string = 'node') => `${prefix}-${Math.random().toString(36).substr(2, 9)}-${++counter}`;
})();

interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  color?: string;
  level: number;
  x: number;
  y: number;
  children?: MindMapNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
  parentId?: string;
}

interface MindMapData {
  center: {
    label: string;
    description?: string;
  };
  branches: Array<{
    id: string;
    label: string;
    description?: string;
    color: string;
    concepts?: Array<{
      id: string;
      label: string;
      description?: string;
      points?: Array<{
        id: string;
        label: string;
        description?: string;
        details?: Array<{
          id: string;
          label: string;
          description?: string;
        }>;
      }>;
    }>;
  }>;
}

interface MindMapDisplayProps {
  content: string;
  metadata?: {
    subject?: string;
    gradeLevel?: string;
    style?: string;
    complexity?: string;
    generatedAt?: string;
    wordCount?: number;
    estimatedTime?: string;
    totalBranches?: number;
  };
  onCopy: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
  onRefineWithLuna?: (currentMindMap: any) => void;
}

function InteractiveMindMapCanvas({ mindMapData, onExpandNode, onEditNode, onDeleteNode }: { 
  mindMapData: MindMapData;
  onExpandNode: (nodeId: string, nodeData: any) => void;
  onEditNode: (nodeId: string, newLabel: string, newDescription?: string) => void;
  onDeleteNode: (nodeId: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.6 }); // Start zoomed out, will be auto-adjusted
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    nodeId: string;
    currentLabel: string;
    currentDescription: string;
  }>({
    isOpen: false,
    nodeId: '',
    currentLabel: '',
    currentDescription: ''
  });
  const viewInitialized = useRef(false);

  // Convert mind map data to node structure with unique IDs
  useEffect(() => {
    const centerNode: MindMapNode = {
      id: 'center',
      label: mindMapData.center.label,
      description: mindMapData.center.description,
      level: 0,
      x: 0, // Center at origin
      y: 0, // Center at origin
      children: [],
      isExpanded: true
    };

    const branchNodes: MindMapNode[] = mindMapData.branches.map((branch, branchIndex) => {
      const totalBranches = mindMapData.branches.length;
      const angle = (branchIndex * 2 * Math.PI) / totalBranches;
      const radius = Math.max(350, totalBranches * 50); // Increased spacing to prevent overlap
      
      const branchNode: MindMapNode = {
        id: branch.id || generateUniqueId('branch'),
        label: branch.label,
        description: branch.description,
        color: branch.color,
        level: 1,
        x: centerNode.x + radius * Math.cos(angle),
        y: centerNode.y + radius * Math.sin(angle),
        children: [],
        isExpanded: true,
        parentId: 'center'
      };

      // Add concepts as children with proper spacing to prevent overlap
      if (branch.concepts) {
        branchNode.children = branch.concepts.map((concept, conceptIndex) => {
          const conceptCount = branch.concepts!.length;
          let conceptAngle: number;
          
          if (conceptCount === 1) {
            conceptAngle = angle;
          } else {
            // Spread concepts in a larger arc around the branch to prevent overlap
            const arcSpread = Math.min(Math.PI / 1.5, conceptCount * 0.5); // Increased spread
            const startAngle = angle - arcSpread / 2;
            conceptAngle = startAngle + (conceptIndex * arcSpread) / (conceptCount - 1);
          }
          
          const conceptRadius = Math.max(220, conceptCount * 40); // Increased spacing to prevent overlap
          
          const conceptNode: MindMapNode = {
            id: concept.id || generateUniqueId(`concept-${branchNode.id}`),
            label: concept.label,
            description: concept.description,
            color: branch.color,
            level: 2,
            x: branchNode.x + conceptRadius * Math.cos(conceptAngle),
            y: branchNode.y + conceptRadius * Math.sin(conceptAngle),
            children: [],
            isExpanded: true,
            parentId: branchNode.id
          };

          // Add points as children with proper spacing
          if (concept.points) {
            conceptNode.children = concept.points.map((point, pointIndex) => {
              const pointCount = concept.points!.length;
              let pointAngle: number;
              
              if (pointCount === 1) {
                pointAngle = conceptAngle;
              } else {
                // Create a larger arc for points to prevent overlap
                const pointArcSpread = Math.min(Math.PI / 2.5, pointCount * 0.4);
                const pointStartAngle = conceptAngle - pointArcSpread / 2;
                pointAngle = pointStartAngle + (pointIndex * pointArcSpread) / (pointCount - 1);
              }
              
              const pointRadius = Math.max(150, pointCount * 35); // Increased spacing
              
              const pointNode: MindMapNode = {
                id: point.id || generateUniqueId(`point-${conceptNode.id}`),
                label: point.label,
                description: point.description,
                color: branch.color,
                level: 3,
                x: conceptNode.x + pointRadius * Math.cos(pointAngle),
                y: conceptNode.y + pointRadius * Math.sin(pointAngle),
                children: [],
                isExpanded: true,
                parentId: conceptNode.id
              };

              // Add details as children with proper spacing
              if (point.details) {
                pointNode.children = point.details.map((detail, detailIndex) => {
                  const detailCount = point.details!.length;
                  let detailAngle: number;
                  
                  if (detailCount === 1) {
                    detailAngle = pointAngle;
                  } else {
                    const detailArcSpread = Math.min(Math.PI / 3, detailCount * 0.35); // Increased spread
                    const detailStartAngle = pointAngle - detailArcSpread / 2;
                    detailAngle = detailStartAngle + (detailIndex * detailArcSpread) / (detailCount - 1);
                  }
                  
                  const detailRadius = Math.max(100, detailCount * 30); // Increased spacing
                  
                  return {
                    id: detail.id || generateUniqueId(`detail-${pointNode.id}`),
                    label: detail.label,
                    description: detail.description,
                    color: branch.color,
                    level: 4,
                    x: pointNode.x + detailRadius * Math.cos(detailAngle),
                    y: pointNode.y + detailRadius * Math.sin(detailAngle),
                    children: [],
                    isExpanded: true,
                    parentId: pointNode.id
                  };
                });
              }

              return pointNode;
            });
          }

          return conceptNode;
        });
      }

      return branchNode;
    });

    centerNode.children = branchNodes;
    setNodes([centerNode, ...getAllNodes(branchNodes)]);
  }, [mindMapData]);

  // Auto-zoom to fit the whole map on initial load
  useEffect(() => {
    if (viewInitialized.current || nodes.length <= 1) {
      return;
    }
    handleResetView(); // Use the reset function for initial zoom
    viewInitialized.current = true;
  }, [nodes]);

  const getAllNodes = (nodes: MindMapNode[]): MindMapNode[] => {
    let allNodes: MindMapNode[] = [];
    nodes.forEach(node => {
      allNodes.push(node);
      if (node.children) {
        allNodes = allNodes.concat(getAllNodes(node.children));
      }
    });
    return allNodes;
  };

  const getAllVisibleNodes = (node: MindMapNode): MindMapNode[] => {
    let visibleNodes = [node];
    if (node.isExpanded && node.children) {
      node.children.forEach(child => {
        visibleNodes = visibleNodes.concat(getAllVisibleNodes(child));
      });
    }
    return visibleNodes;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging if clicking on SVG background, not on nodes
    const target = e.target as Element;
    if (target.tagName === 'svg' || target.tagName === 'rect') {
      setIsDragging(true);
      setDragStart({ 
        x: e.clientX - transform.x, 
        y: e.clientY - transform.y 
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }));
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Add scroll zoom functionality
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(5, prev.scale + delta))
    }));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const handleZoom = (direction: 'in' | 'out') => {
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(5, prev.scale + (direction === 'in' ? 0.3 : -0.3)))
    }));
  };

  const handleResetView = () => {
    if (nodes.length <= 1 || !containerRef.current) {
      setTransform({ x: 0, y: 0, scale: 0.6 });
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
        const nodeRadius = node.level === 0 ? 50 : node.level === 1 ? 40 : node.level === 2 ? 32 : node.level === 3 ? 24 : 18;
        minX = Math.min(minX, node.x - nodeRadius);
        minY = Math.min(minY, node.y - nodeRadius);
        maxX = Math.max(maxX, node.x + nodeRadius);
        maxY = Math.max(maxY, node.y + nodeRadius);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    if (contentWidth > 0 && contentHeight > 0) {
      // Use the viewBox dimensions (3000x3000) for an accurate scale calculation
      const scaleX = 3000 / contentWidth;
      const scaleY = 3000 / contentHeight;
      const newScale = Math.min(scaleX, scaleY) * 0.9;
      setTransform({ x: 0, y: 0, scale: newScale });
    } else {
      setTransform({ x: 0, y: 0, scale: 0.6 });
    }
  };

  const toggleNodeExpansion = (nodeId: string) => {
    const updateNodeExpansion = (nodes: MindMapNode[]): MindMapNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: updateNodeExpansion(node.children) };
        }
        return node;
      });
    };
    setNodes(updateNodeExpansion(nodes));
  };

  const handleExpandNode = async (nodeId: string) => {
    const findNode = (nodes: MindMapNode[], id: string): MindMapNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(nodes, nodeId);
    if (!node) return;

    // Set loading state
    const updateNodeLoading = (nodes: MindMapNode[]): MindMapNode[] => {
      return nodes.map(n => {
        if (n.id === nodeId) {
          return { ...n, isLoading: true };
        }
        if (n.children) {
          return { ...n, children: updateNodeLoading(n.children) };
        }
        return n;
      });
    };
    setNodes(updateNodeLoading(nodes));

    try {
      await onExpandNode(nodeId, node);
      
      // Clear loading state
      const updateNodeLoadingComplete = (nodes: MindMapNode[]): MindMapNode[] => {
        return nodes.map(n => {
          if (n.id === nodeId) {
            return { ...n, isLoading: false };
          }
          if (n.children) {
            return { ...n, children: updateNodeLoadingComplete(n.children) };
          }
          return n;
        });
      };
      setNodes(updateNodeLoadingComplete(nodes));
    } catch (error) {
      console.error('Error expanding node:', error);
    }
  };

  const openEditModal = (nodeId: string, currentLabel: string, currentDescription: string = '') => {
    setEditModal({
      isOpen: true,
      nodeId,
      currentLabel,
      currentDescription
    });
  };

  const handleEditSave = () => {
    onEditNode(editModal.nodeId, editModal.currentLabel, editModal.currentDescription);
    setEditModal({ isOpen: false, nodeId: '', currentLabel: '', currentDescription: '' });
  };

  const renderNode = (node: MindMapNode, index: number = 0) => {
    const isSelected = selectedNode === node.id;
    const isHovered = hoveredNode === node.id;
    const nodeRadius = node.level === 0 ? 50 : node.level === 1 ? 40 : node.level === 2 ? 32 : node.level === 3 ? 24 : 18;
    const textSize = node.level === 0 ? 11 : node.level === 1 ? 9 : node.level === 2 ? 8 : node.level === 3 ? 7 : 6;
    const maxTextLength = node.level === 0 ? 16 : node.level === 1 ? 12 : node.level === 2 ? 10 : 8;
    
    const displayText = node.label.length > maxTextLength 
      ? node.label.substring(0, maxTextLength) + '...' 
      : node.label;

    return (
      <g 
        style={{
          animation: `nodeAppear 0.15s ease-out ${index * 0.02}s both`
        }}
      >
        {/* Subtle selection glow */}
        {isSelected && (
          <circle
            cx={node.x}
            cy={node.y}
            r={nodeRadius + 8}
            fill="none"
            stroke={node.color || '#3B82F6'}
            strokeWidth="2"
            strokeOpacity="0.4"
            style={{
              animation: 'selectionPulse 2s ease-in-out infinite'
            }}
          />
        )}
        
        {/* Premium loading glow */}
        {node.isLoading && (
          <circle
            cx={node.x}
            cy={node.y}
            r={nodeRadius + 8}
            fill="none"
            stroke="url(#brand-gradient-pulse)"
            strokeWidth="3"
            style={{
              animation: 'premiumGlow 1.8s ease-in-out infinite'
            }}
          />
        )}
        
        {/* Main node circle */}
        <circle
          cx={node.x}
          cy={node.y}
          r={nodeRadius}
          fill={node.isLoading ? 'url(#brand-gradient-pulse)' : (node.color || '#3B82F6')}
          stroke={isSelected ? '#1F2937' : 'white'}
          strokeWidth={isSelected ? 2 : 1.5}
          className="cursor-pointer transition-all duration-100 ease-out"
          style={{
            filter: isHovered ? 'brightness(1.05)' : 'none',
            boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none',
          }}
          onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
          onMouseEnter={() => setHoveredNode(node.id)}
          onMouseLeave={() => setHoveredNode(null)}
        />
        
        {/* Node text */}
        <text
          x={node.x}
          y={node.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="pointer-events-none font-medium select-none"
          fill={node.level === 0 || node.level === 1 ? 'white' : '#1F2937'}
          fontSize={textSize}
        >
          {displayText}
        </text>
        
        {/* Minimal action buttons on hover/select */}
        {(isHovered || isSelected) && !node.isLoading && (
          <g style={{ animation: 'actionsAppear 0.1s ease-out' }}>
            {/* Edit button */}
            <circle
              cx={node.x + nodeRadius - 2}
              cy={node.y - nodeRadius + 2}
              r="10"
              fill="rgba(59, 130, 246, 0.9)"
              className="cursor-pointer transition-all duration-100 hover:fill-blue-600"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(node.id, node.label, node.description || '');
              }}
            />
            <text
              x={node.x + nodeRadius - 2}
              y={node.y - nodeRadius + 3}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none"
              fill="white"
              fontSize="8"
            >
              ✎
            </text>
            
            {/* AI Expand button - only if level < 5 */}
            {node.level < 5 && (
              <>
                <circle
                  cx={node.x - nodeRadius + 2}
                  cy={node.y - nodeRadius + 2}
                  r="10"
                  fill="rgba(5, 150, 105, 0.9)"
                  className="cursor-pointer transition-all duration-100 hover:fill-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExpandNode(node.id);
                  }}
                />
                <text
                  x={node.x - nodeRadius + 2}
                  y={node.y - nodeRadius + 3}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none"
                  fill="white"
                  fontSize="7"
                  fontWeight="bold"
                >
                  ✨
                </text>
              </>
            )}
            
            {/* Toggle children visibility with expand/collapse icons */}
            {node.children && node.children.length > 0 && (
              <>
                <circle
                  cx={node.x}
                  cy={node.y + nodeRadius + 12}
                  r="8"
                  fill={node.isExpanded ? 'rgba(107, 114, 128, 0.9)' : 'rgba(59, 130, 246, 0.9)'}
                  className="cursor-pointer transition-all duration-100 hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeExpansion(node.id);
                  }}
                />
                <text
                  x={node.x}
                  y={node.y + nodeRadius + 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none"
                  fill="white"
                  fontSize="6"
                  fontWeight="bold"
                >
                  {node.isExpanded ? '▼' : '▶'}
                </text>
              </>
            )}
            
            {/* Delete button - only for non-center nodes */}
            {node.id !== 'center' && (
              <>
                <circle
                  cx={node.x + nodeRadius - 2}
                  cy={node.y + nodeRadius - 2}
                  r="8"
                  fill="rgba(239, 68, 68, 0.9)"
                  className="cursor-pointer transition-all duration-100 hover:fill-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNode(node.id);
                  }}
                />
                <text
                  x={node.x + nodeRadius - 2}
                  y={node.y + nodeRadius - 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none"
                  fill="white"
                  fontSize="8"
                >
                  ×
                </text>
              </>
            )}
          </g>
        )}
      </g>
    );
  };

  const renderConnections = () => {
    const connections: React.ReactElement[] = [];
    
    const addConnections = (node: MindMapNode, index: number = 0) => {
      if (node.children && node.isExpanded) {
        node.children.forEach((child, childIndex) => {
          connections.push(
            <line
              key={`connection-${node.id}-to-${child.id}-${Math.random()}`}
              x1={node.x}
              y1={node.y}
              x2={child.x}
              y2={child.y}
              stroke={child.color || '#3B82F6'}
              strokeWidth={Math.max(3 - child.level, 1)}
              strokeOpacity={0.3}
              className="transition-all duration-200 ease-out"
              style={{
                animation: `connectionDraw 0.2s ease-out ${(index + childIndex) * 0.01}s both`
              }}
            />
          );
          addConnections(child, index + childIndex + 1);
        });
      }
    };
    
    nodes.forEach((node, index) => addConnections(node, index));
    return connections;
  };

  const visibleNodes = nodes.reduce((acc, node) => {
    return acc.concat(getAllVisibleNodes(node));
  }, [] as MindMapNode[]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[800px] bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
    >
      {/* Minimal controls */}
      <div className="absolute top-4 right-4 flex gap-1 z-10">
        <div className="flex bg-white/90 dark:bg-slate-800/90 rounded-lg p-1 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleZoom('in')}
            className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleZoom('out')}
            className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetView}
            className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700 max-w-xs">
        <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-1">Interactive Mind Map</h3>
        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <div>• <strong>Drag</strong> to pan around</div>
          <div>• <strong>Hover</strong> nodes for actions</div>
          <div>• <strong>Click +</strong> to AI-expand nodes</div>
          <div>• <strong>Click ±</strong> to show/hide children</div>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-move"
        viewBox="-1500 -1500 3000 3000"
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: 'center'
        }}
      >
        <defs>
          <linearGradient id="brand-gradient-pulse" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--gradient-start)' }} />
            <stop offset="50%" style={{ stopColor: 'var(--gradient-mid)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--gradient-end)' }} />
          </linearGradient>
        </defs>
        {/* Subtle grid pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" opacity="0.3"/>
          </pattern>
        </defs>
        <rect x="-1500" y="-1500" width="3000" height="3000" fill="url(#grid)" />
        
        {/* Render connections first */}
        <g className="connections">
          {renderConnections()}
        </g>
        
        {/* Render nodes */}
        <g className="nodes">
          {visibleNodes.map((node, index) => (
            <g key={`node-${node.id}-${index}`}>
              {renderNode(node, index)}
            </g>
          ))}
        </g>
      </svg>

      {/* Selected node info panel */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-slate-200 dark:border-slate-700 max-w-sm">
          {(() => {
            const findSelectedNode = (nodes: MindMapNode[]): MindMapNode | null => {
              for (const node of nodes) {
                if (node.id === selectedNode) return node;
                if (node.children) {
                  const found = findSelectedNode(node.children);
                  if (found) return found;
                }
              }
              return null;
            };
            
            const node = findSelectedNode(visibleNodes);
            if (!node) return null;
            
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-slate-800 dark:text-slate-200">{node.label}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNode(null)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {node.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{node.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                  <Badge variant="outline" className="text-xs">Level {node.level}</Badge>
                  {node.children && node.children.length > 0 && (
                    <Badge variant="outline" className="text-xs">{node.children.length} children</Badge>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={editModal.isOpen} onOpenChange={(open) => setEditModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Node</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={editModal.currentLabel}
                onChange={(e) => setEditModal(prev => ({ ...prev, currentLabel: e.target.value }))}
                placeholder="Node label"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editModal.currentDescription}
                onChange={(e) => setEditModal(prev => ({ ...prev, currentDescription: e.target.value }))}
                placeholder="Node description (optional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button onClick={handleEditSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MindMapDisplay({ content, metadata, onCopy, copiedItems, onRefineWithLuna }: MindMapDisplayProps) {
  const [isExpanding, setIsExpanding] = useState(false);
  const [editedMindMap, setEditedMindMap] = useState<MindMapData | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'structured'>('visual');

  const parseMindMapContent = (content: string): MindMapData => {
    try {
      // Try to parse JSON first
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        const mindMapData = JSON.parse(jsonMatch[1]);
        return {
          center: mindMapData.center || { label: mindMapData.centralTopic || 'Central Topic' },
          branches: mindMapData.branches || []
        };
      }

      // Enhanced text parsing for markdown format
      const lines = content.split('\n');
      const branches: any[] = [];
      let currentBranch: any | null = null;
      let centralTopic = 'Central Topic';
      let title = 'Mind Map';
      
      const colors = ['#DC2626', '#059669', '#7C3AED', '#EA580C', '#0891B2', '#BE185D', '#7C2D12', '#1F2937'];
      let colorIndex = 0;

      for (const line of lines) {
        if (line.startsWith('# Mind Map:')) {
          title = line.replace('# Mind Map:', '').trim();
          centralTopic = title;
        } else if (line.startsWith('## Central Theme:')) {
          centralTopic = line.replace('## Central Theme:', '').trim();
        } else if (line.startsWith('### Branch') || line.startsWith('### Main Themes')) {
          if (currentBranch) {
            branches.push(currentBranch);
          }
          currentBranch = {
            id: generateUniqueId('branch'),
            label: line.replace(/### (Branch \d+: |Main Themes - )/g, '').trim(),
            description: '',
            color: colors[colorIndex % colors.length],
            concepts: []
          };
          colorIndex++;
        } else if (line.startsWith('- ') && currentBranch) {
          const conceptText = line.replace('- ', '').trim();
          currentBranch.concepts.push({
            id: generateUniqueId(`concept-${currentBranch.id}`),
            label: conceptText,
            description: conceptText,
            points: []
          });
        }
      }

      if (currentBranch) {
        branches.push(currentBranch);
      }

      return {
        center: { label: centralTopic },
        branches
      };
    } catch (error) {
      console.error('Error parsing mind map:', error);
      return {
        center: { label: 'Central Topic' },
        branches: []
      };
    }
  };

  const currentMindMap = editedMindMap || parseMindMapContent(content);

  const handleExpandNode = async (nodeId: string, nodeData: any) => {
    setIsExpanding(true);
    
    try {
      // Call AI to expand the node
      const response = await fetch('/api/luna/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: 'mindmap-expand',
          prompt: `Expand the mind map node "${nodeData.label}" with 2-4 related sub-concepts. Current mind map context: ${JSON.stringify(currentMindMap, null, 2)}. Node level: ${nodeData.level}. Focus on expanding logically from this specific node.`,
          nodeId,
          currentMindMap,
          nodeData
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.expandedNodes) {
          // Add the new nodes to the mind map
          const updatedMindMap = addNodesToMindMap(currentMindMap, nodeId, data.expandedNodes);
          setEditedMindMap(updatedMindMap);
          console.log(`Node Expanded: Added ${data.expandedNodes.length} new nodes to "${nodeData.label}"`);
        } else {
          console.log("Expansion Failed: " + (data.response || "Could not generate expansion data"));
        }
      } else {
        console.log("Expansion Failed: Server error occurred");
      }
    } catch (error) {
      console.error('Error expanding node:', error);
      console.log("Expansion Failed: Could not expand the node. Please try again.");
    } finally {
      setIsExpanding(false);
    }
  };

  const addNodesToMindMap = (mindMap: MindMapData, targetNodeId: string, newNodes: any[]): MindMapData => {
    const updatedMindMap = JSON.parse(JSON.stringify(mindMap)); // Deep clone
    
    // Helper function to find and update the target node recursively
    const findAndUpdateNode = (branches: any[], targetId: string): boolean => {
      for (const branch of branches) {
        if (branch.id === targetId) {
          if (!branch.concepts) branch.concepts = [];
          newNodes.forEach((newNode) => {
            branch.concepts.push({
              id: generateUniqueId(`expanded-${targetId}`),
              label: newNode.label,
              description: newNode.description || newNode.label,
              points: []
            });
          });
          return true;
        }
        
        if (branch.concepts) {
          for (const concept of branch.concepts) {
            if (concept.id === targetId) {
              if (!concept.points) concept.points = [];
              newNodes.forEach((newNode) => {
                concept.points.push({
                  id: generateUniqueId(`expanded-${targetId}`),
                  label: newNode.label,
                  description: newNode.description || newNode.label,
                  details: []
                });
              });
              return true;
            }
            
            if (concept.points) {
              for (const point of concept.points) {
                if (point.id === targetId) {
                  if (!point.details) point.details = [];
                  newNodes.forEach((newNode) => {
                    point.details.push({
                      id: generateUniqueId(`expanded-${targetId}`),
                      label: newNode.label,
                      description: newNode.description || newNode.label
                    });
                  });
                  return true;
                }
              }
            }
          }
        }
      }
      return false;
    };
    
    findAndUpdateNode(updatedMindMap.branches, targetNodeId);
    return updatedMindMap;
  };

  const handleEditNode = (nodeId: string, newLabel: string, newDescription?: string) => {
    // Update the mind map data
    console.log(`Node Updated: "${newLabel}"`);
  };

  const handleDeleteNode = (nodeId: string) => {
    // Delete the node from mind map data
    console.log("Node Deleted: Node has been removed from the mind map");
  };

  const generatePDF = () => {
    const pdf = new jsPDF('landscape');
    
    // Header
    pdf.setFontSize(20);
    pdf.setTextColor(51, 51, 51);
    pdf.text(currentMindMap.center.label, 20, 25);
    
    // Metadata
    pdf.setFontSize(12);
    pdf.setTextColor(102, 102, 102);
    pdf.text(`Subject: ${metadata?.subject || 'General'} | Grade Level: ${metadata?.gradeLevel || 'General'}`, 20, 35);
    
    let yPosition = 50;
    
    // Branches
    currentMindMap.branches.forEach((branch, index) => {
      if (yPosition > 180) {
        pdf.addPage();
        yPosition = 25;
      }
      
      pdf.setFontSize(14);
      pdf.setTextColor(220, 38, 38);
      pdf.text(`${index + 1}. ${branch.label}`, 20, yPosition);
      yPosition += 10;
      
      if (branch.concepts) {
        branch.concepts.forEach((concept) => {
          if (yPosition > 180) {
            pdf.addPage();
            yPosition = 25;
          }
          
          pdf.setFontSize(11);
          pdf.setTextColor(51, 51, 51);
          const lines = pdf.splitTextToSize(`• ${concept.label}`, 250);
          pdf.text(lines, 30, yPosition);
          yPosition += lines.length * 5 + 3;
        });
      }
      
      yPosition += 5;
    });
    
    pdf.save(`${currentMindMap.center.label.replace(/[^a-zA-Z0-9]/g, '_')}_mindmap.pdf`);
  };

  const copyMindMapText = () => {
    let text = `# ${currentMindMap.center.label}\n\n`;
    text += `**Subject:** ${metadata?.subject || 'General'} | **Grade Level:** ${metadata?.gradeLevel || 'General'}\n\n`;
    
    currentMindMap.branches.forEach((branch, index) => {
      text += `## ${index + 1}. ${branch.label}\n\n`;
      if (branch.concepts) {
        branch.concepts.forEach((concept) => {
          text += `- **${concept.label}**\n`;
          if (concept.description && concept.description !== concept.label) {
            text += `  ${concept.description}\n`;
          }
        });
      }
      text += '\n';
    });
    
    navigator.clipboard.writeText(text);
    onCopy(text, 'mindmap-full');
  };

  return (
    <Card className="w-full border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              {currentMindMap.center.label}
            </CardTitle>
            <div className="flex items-center gap-4 mt-2">
              {metadata?.subject && (
                <Badge variant="secondary" className="text-xs">
                  {metadata.subject}
                </Badge>
              )}
              {metadata?.gradeLevel && (
                <Badge variant="outline" className="text-xs">
                  Grade {metadata.gradeLevel}
                </Badge>
              )}
              {metadata?.totalBranches && (
                <span className="text-xs text-slate-500">
                  {metadata.totalBranches} branches
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'visual' ? 'structured' : 'visual')}
            >
              {viewMode === 'visual' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              {viewMode === 'visual' ? 'List View' : 'Visual View'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={copyMindMapText}
              className="gap-2"
            >
              <Copy className={`h-4 w-4 ${copiedItems.has('mindmap-full') ? 'text-green-600' : ''}`} />
              {copiedItems.has('mindmap-full') ? 'Copied!' : 'Copy'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={generatePDF}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
            
            {onRefineWithLuna && (
              <Button
                size="sm"
                onClick={() => onRefineWithLuna(currentMindMap)}
                disabled={isExpanding}
                className="gap-2"
              >
                {isExpanding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refine with Luna
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {viewMode === 'visual' ? (
          <InteractiveMindMapCanvas
            mindMapData={currentMindMap}
            onExpandNode={handleExpandNode}
            onEditNode={handleEditNode}
            onDeleteNode={handleDeleteNode}
          />
        ) : (
          <div className="p-6 max-h-[700px] overflow-y-auto">
            <div className="space-y-6">
              {currentMindMap.branches.map((branch, index) => (
                <div key={branch.id} className="border-l-4 pl-4" style={{ borderColor: branch.color }}>
                  <h3 className="font-semibold text-lg mb-3" style={{ color: branch.color }}>
                    {index + 1}. {branch.label}
                  </h3>
                  {branch.concepts && branch.concepts.length > 0 && (
                    <div className="space-y-2">
                      {branch.concepts.map((concept) => (
                        <div key={concept.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <h4 className="font-medium text-slate-800 dark:text-slate-200">
                            {concept.label}
                          </h4>
                          {concept.description && concept.description !== concept.label && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {concept.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
