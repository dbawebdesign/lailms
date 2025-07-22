'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, Edit3, Check, RefreshCw, Plus, Minus, Expand, Eye, List, Grid, X, Trash2, ZoomIn, ZoomOut, Move, RotateCcw, Loader2, ArrowLeft, Save, Map } from 'lucide-react';
import jsPDF from 'jspdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

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

interface StudyMindMapViewerProps {
  selectedContent?: any[];
  selectedText?: { text: string; source: string };
  currentNotes?: any[];
  baseClassId?: string;
  studySpaceId?: string; // Add study space ID prop
  onMindMapCreated?: (mindMapData: any) => void;
  shouldAutoGenerate?: boolean; // New prop to trigger auto-generation
  currentMindMap?: any; // Mind map state from parent
  onMindMapChanged?: (mindMapData: any) => void; // Callback to update parent state
}

interface MindMapDisplayProps {
  content: string;
  metadata?: any;
  onCopy?: (content: string) => void;
  copiedItems?: Set<string>;
  onRefineWithLuna?: (content: string) => void;
  onMindMapUpdate?: (updatedMindMap: MindMapData) => void;
  onBack?: () => void;
  onSave?: (mindMapData: MindMapData, title: string) => void;
}

function InteractiveMindMapCanvas({ mindMapData, onExpandNode, onEditNode, onDeleteNode }: { 
  mindMapData: MindMapData;
  onExpandNode: (nodeId: string, nodeData: any) => void;
  onEditNode: (nodeId: string, newLabel: string, newDescription?: string) => void;
  onDeleteNode: (nodeId: string) => void;
}) {
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<{ id: string; label: string; description: string } | null>(null);
  const [expandingNodes, setExpandingNodes] = useState<Set<string>>(new Set());
  
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewInitialized = useRef(false);

  // Convert mind map data to node structure with unique IDs
  useEffect(() => {
    // Add defensive checks for mindMapData structure
    if (!mindMapData || !mindMapData.center) {
      console.error('Invalid mind map data:', mindMapData);
      return;
    }

    console.log('Processing mind map data:', JSON.stringify(mindMapData, null, 2));

    const centerNode: MindMapNode = {
      id: 'center',
      label: mindMapData.center.label || 'Untitled Topic',
      description: mindMapData.center.description || '',
      level: 0,
      x: 0,
      y: 0,
      children: [],
      isExpanded: true
    };

    const branchNodes: MindMapNode[] = (mindMapData.branches || []).map((branch, branchIndex) => {
      const totalBranches = mindMapData.branches?.length || 1;
      const angle = (branchIndex * 2 * Math.PI) / totalBranches;
      const radius = Math.max(350, totalBranches * 50);
      
      const branchNode: MindMapNode = {
        id: branch.id || generateUniqueId('branch'),
        label: branch.label || 'Untitled Branch',
        description: branch.description || '',
        color: branch.color || '#3B82F6',
        level: 1,
        x: centerNode.x + radius * Math.cos(angle),
        y: centerNode.y + radius * Math.sin(angle),
        children: [],
        isExpanded: true,
        parentId: 'center'
      };

      if (branch.concepts && Array.isArray(branch.concepts)) {
        branchNode.children = branch.concepts.map((concept, conceptIndex) => {
          const conceptCount = branch.concepts!.length;
          const conceptAngle = angle + (conceptIndex - (conceptCount - 1) / 2) * 0.3;
          const conceptRadius = 200;
          
          const conceptNode: MindMapNode = {
            id: concept.id || generateUniqueId(`concept-${branchIndex}`),
            label: concept.label || 'Untitled Concept',
            description: concept.description || '',
            color: branch.color || '#3B82F6',
            level: 2,
            x: branchNode.x + conceptRadius * Math.cos(conceptAngle),
            y: branchNode.y + conceptRadius * Math.sin(conceptAngle),
            children: [],
            isExpanded: true,
            parentId: branchNode.id
          };

          if (concept.points && Array.isArray(concept.points)) {
            conceptNode.children = concept.points.map((point, pointIndex) => {
              const pointCount = concept.points!.length;
              const pointAngle = conceptAngle + (pointIndex - (pointCount - 1) / 2) * 0.4;
              const pointRadius = 120;
              
              const pointNode: MindMapNode = {
                id: point.id || generateUniqueId(`point-${branchIndex}-${conceptIndex}`),
                label: point.label || 'Untitled Point',
                description: point.description || '',
                color: branch.color || '#3B82F6',
                level: 3,
                x: conceptNode.x + pointRadius * Math.cos(pointAngle),
                y: conceptNode.y + pointRadius * Math.sin(pointAngle),
                children: [],
                isExpanded: true,
                parentId: conceptNode.id
              };

              if (point.details && Array.isArray(point.details)) {
                pointNode.children = point.details.map((detail, detailIndex) => {
                  const detailCount = point.details!.length;
                  const detailAngle = pointAngle + (detailIndex - (detailCount - 1) / 2) * 0.5;
                  const detailRadius = 80;
                  
                  return {
                    id: detail.id || generateUniqueId(`detail-${pointNode.id}`),
                    label: detail.label || 'Untitled Detail',
                    description: detail.description || '',
                    color: branch.color || '#3B82F6',
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
    handleResetView();
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
    const delta = direction === 'in' ? 0.2 : -0.2;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.1, Math.min(5, prev.scale + delta))
    }));
  };

  const handleResetView = () => {
    if (nodes.length === 0) return;

    const centerNode = nodes.find(n => n.id === 'center');
    if (centerNode) {
      const container = containerRef.current;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        
        setTransform({
          x: centerX - centerNode.x,
          y: centerY - centerNode.y,
          scale: 0.8
        });
      }
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

    setExpandingNodes(prev => new Set([...prev, nodeId]));

    try {
      await onExpandNode(nodeId, node);
    } catch (error) {
      console.error('Error expanding node:', error);
    } finally {
      setExpandingNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(nodeId);
        return newSet;
      });
    }
  };

  const openEditModal = (nodeId: string, currentLabel: string, currentDescription: string = '') => {
    setEditModalOpen(true);
    setEditingNode({ id: nodeId, label: currentLabel, description: currentDescription });
  };

  const handleEditSave = () => {
    if (editingNode) {
      onEditNode(editingNode.id, editingNode.label, editingNode.description);
      setEditModalOpen(false);
      setEditingNode(null);
    }
  };

  const renderNode = (node: MindMapNode, index: number = 0) => {
    // Add error boundary for node rendering
    if (!node) {
      console.error('Attempting to render null/undefined node');
      return null;
    }

    const isSelected = selectedNodeId === node.id;
    const isHovered = hoveredNodeId === node.id;
    const isExpanding = expandingNodes.has(node.id);
    const nodeRadius = node.level === 0 ? 50 : node.level === 1 ? 40 : node.level === 2 ? 32 : node.level === 3 ? 24 : 18;
    const textSize = node.level === 0 ? 11 : node.level === 1 ? 9 : node.level === 2 ? 8 : node.level === 3 ? 7 : 6;
    
    const maxLength = node.level === 0 ? 15 : node.level === 1 ? 12 : node.level === 2 ? 10 : 8;
    const nodeLabel = node.label || 'Untitled';
    const displayText = nodeLabel.length > maxLength ? nodeLabel.substring(0, maxLength) + '...' : nodeLabel;

    return (
      <g key={`node-${node.id}-${index}`}>
        <circle
          cx={node.x}
          cy={node.y}
          r={nodeRadius}
          fill={node.level === 0 ? '#1F2937' : node.level === 1 ? node.color || '#3B82F6' : node.color + '80' || '#3B82F680'}
          stroke={node.level === 0 ? '#374151' : node.color || '#3B82F6'}
          strokeWidth={node.level === 0 ? 3 : 2}
          className="transition-all duration-200 cursor-pointer"
          style={{
            filter: isSelected ? 'brightness(1.2)' : isHovered ? 'brightness(1.1)' : 'none',
          }}
          onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
          onMouseEnter={() => setHoveredNodeId(node.id)}
          onMouseLeave={() => setHoveredNodeId(null)}
        />
        
        {isExpanding && (
          <g>
            <circle
              cx={node.x}
              cy={node.y}
              r={nodeRadius + 5}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeDasharray="8,4"
              opacity="0.7"
            >
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from={`0 ${node.x} ${node.y}`}
                to={`360 ${node.x} ${node.y}`}
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none font-medium select-none"
              fill="white"
              fontSize="8"
            >
              ⟳
            </text>
          </g>
        )}

        {!isExpanding && (
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
        )}
        
        {(isHovered || isSelected) && !isExpanding && (
          <g>
            <circle
              cx={node.x + nodeRadius - 2}
              cy={node.y - nodeRadius + 2}
              r="10"
              fill="rgba(59, 130, 246, 0.9)"
              className="cursor-pointer transition-all duration-100 hover:fill-blue-600"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(node.id, node.label || 'Untitled', node.description || '');
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

  const renderConnection = (parent: MindMapNode, child: MindMapNode) => {
    return (
      <line
        key={`connection-${parent.id}-${child.id}`}
        x1={parent.x}
        y1={parent.y}
        x2={child.x}
        y2={child.y}
        stroke={child.color || '#3B82F6'}
        strokeWidth="2"
        opacity="0.6"
        className="transition-all duration-200"
      />
    );
  };

  const centerNode = nodes.find(n => n.id === 'center');
  const allVisibleNodes = centerNode ? getAllVisibleNodes(centerNode) : [];

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full min-h-[400px] bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
    >
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        {/* Zoom Controls */}
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
        
        {/* Instructions */}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-slate-200 dark:border-slate-700 max-w-xs">
          <h3 className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-1">Study Mind Map</h3>
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div>• <strong>Drag</strong> to pan around</div>
            <div>• <strong>Hover</strong> nodes for actions</div>
            <div>• <strong>Click ✨</strong> to AI-expand nodes</div>
            <div>• <strong>Click ±</strong> to show/hide children</div>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <rect width="100%" height="100%" fill="transparent" />
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          <g>
            {allVisibleNodes.map(node => 
              node.children?.map(child => 
                child.isExpanded ? renderConnection(node, child) : null
              )
            )}
          </g>
          <g>
            {allVisibleNodes.map((node, index) => renderNode(node, index))}
          </g>
        </g>
      </svg>

      {/* Selected node info panel */}
      {selectedNodeId && (
        <div className="absolute top-4 left-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-slate-200 dark:border-slate-700 max-w-sm z-10">
          {(() => {
            const findSelectedNode = (nodes: MindMapNode[]): MindMapNode | null => {
              for (const node of nodes) {
                if (node.id === selectedNodeId) return node;
                if (node.children) {
                  const found = findSelectedNode(node.children);
                  if (found) return found;
                }
              }
              return null;
            };
            
            const node = findSelectedNode(allVisibleNodes);
            if (!node) return null;
            
            return (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-slate-800 dark:text-slate-200">{node.label || 'Untitled'}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNodeId(null)}
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

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Node</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nodeLabel">Label</Label>
              <Input
                id="nodeLabel"
                value={editingNode?.label || ''}
                onChange={(e) => setEditingNode(prev => prev ? { ...prev, label: e.target.value } : null)}
              />
            </div>
            <div>
              <Label htmlFor="nodeDescription">Description</Label>
              <Textarea
                id="nodeDescription"
                value={editingNode?.description || ''}
                onChange={(e) => setEditingNode(prev => prev ? { ...prev, description: e.target.value } : null)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
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

export function MindMapDisplay({ content, metadata, onCopy, copiedItems, onRefineWithLuna, onMindMapUpdate, onBack, onSave }: MindMapDisplayProps) {
  const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
  const [editedMindMap, setEditedMindMap] = useState<MindMapData | null>(null);

  const parseMindMapContent = (content: string): MindMapData => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.center && parsed.branches) {
        return parsed;
      }
    } catch {
      // If JSON parsing fails, parse as markdown text
    }

    const lines = content.split('\n').filter(line => line.trim());
    const branches: any[] = [];
    let currentBranch: any = null;
    let centralTopic = 'Study Topic';
    
    const colors = ['#DC2626', '#059669', '#7C3AED', '#EA580C', '#0891B2', '#BE185D', '#7C2D12', '#1F2937'];
    let colorIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# Mind Map:')) {
        centralTopic = trimmed.replace('# Mind Map:', '').trim();
      } else if (trimmed.startsWith('### ')) {
        if (currentBranch) branches.push(currentBranch);
        currentBranch = {
          id: generateUniqueId('branch'),
          label: trimmed.replace('### ', '').replace(':', ''),
          description: '',
          color: colors[colorIndex % colors.length],
          concepts: []
        };
        colorIndex++;
      } else if (trimmed.startsWith('- ') && currentBranch) {
        currentBranch.concepts.push({
          id: generateUniqueId('concept'),
          label: trimmed.replace('- ', ''),
          description: trimmed.replace('- ', ''),
          points: []
        });
      }
    }
    
    if (currentBranch) branches.push(currentBranch);

    return {
      center: { label: centralTopic, description: `Study mind map for ${centralTopic}` },
      branches
    };
  };

  const currentMindMap = editedMindMap || parseMindMapContent(content);

  const handleExpandNode = async (nodeId: string, nodeData: any) => {
    try {
      const response = await fetch('/api/study-space/mind-map/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          nodeData,
          currentMindMap,
          studyContext: metadata?.studyContext
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.expandedNodes) {
          const updatedMindMap = addNodesToMindMap(currentMindMap, nodeId, data.expandedNodes);
          setEditedMindMap(updatedMindMap);
          onMindMapUpdate?.(updatedMindMap);
        }
      }
    } catch (error) {
      console.error('Error expanding node:', error);
    }
  };

  const addNodesToMindMap = (mindMap: MindMapData, targetNodeId: string, newNodes: any[]): MindMapData => {
    const updatedMindMap = JSON.parse(JSON.stringify(mindMap));
    
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
    // Implementation for editing nodes
    console.log('Edit node:', nodeId, newLabel, newDescription);
  };

  const handleDeleteNode = (nodeId: string) => {
    // Implementation for deleting nodes
    console.log('Delete node:', nodeId);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {onBack && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBack}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </Button>
            )}
            <div>
              <CardTitle className="text-lg">Study Mind Map</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Interactive visualization of your study content
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const title = prompt('Enter a title for this mind map:');
                  if (title && currentMindMap) {
                    onSave(currentMindMap, title);
                  }
                }}
                className="flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </Button>
            )}
            <Button
              variant={viewMode === 'visual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('visual')}
            >
              <Grid className="h-4 w-4 mr-1" />
              Visual
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 h-[calc(100vh-200px)] min-h-[500px]">
        {viewMode === 'visual' ? (
          <div className="h-full w-full">
            <InteractiveMindMapCanvas
              mindMapData={currentMindMap}
              onExpandNode={handleExpandNode}
              onEditNode={handleEditNode}
              onDeleteNode={handleDeleteNode}
            />
          </div>
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

export function StudyMindMapViewer({ selectedContent, selectedText, currentNotes, baseClassId, studySpaceId, onMindMapCreated, shouldAutoGenerate, currentMindMap: parentMindMap, onMindMapChanged }: StudyMindMapViewerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  // Use parent state if provided, otherwise fall back to local state
  const [localMindMap, setLocalMindMap] = useState<MindMapData | null>(null);
  const currentMindMap = parentMindMap || localMindMap;
  const setCurrentMindMap = onMindMapChanged || setLocalMindMap;
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [mindMapTitle, setMindMapTitle] = useState('');
  const [savedMindMaps, setSavedMindMaps] = useState<any[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);
  const generationInProgress = useRef(false); // Track generation state across re-renders

  const supabase = createClient();

  // If no study space is selected, show a message
  if (!studySpaceId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 mb-6 inline-block">
          <Map className="h-12 w-12 text-slate-400 mx-auto" />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">
          No Study Space Selected
        </h3>
        <p className="text-slate-600 dark:text-slate-400 text-center max-w-md leading-relaxed">
          Select a study space to view and create mind maps. Mind maps are saved to specific study spaces to keep your work organized.
        </p>
      </div>
    );
  }

  // Load saved mind maps
  const loadSavedMindMaps = async () => {
    setIsLoadingSaved(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('mind_maps')
        .select('*')
        .eq('user_id', user.id);

      // Filter by study space if one is selected
      if (studySpaceId) {
        query = query.eq('study_space_id', studySpaceId);
      }

      const { data: mindMaps, error } = await query
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading saved mind maps:', error);
      } else {
        console.log('Loaded mind maps for study space:', studySpaceId, mindMaps);
        setSavedMindMaps(mindMaps || []);
      }
    } catch (error) {
      console.error('Error loading saved mind maps:', error);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  // Load saved mind maps on component mount and when study space changes
  React.useEffect(() => {
    loadSavedMindMaps();
  }, [studySpaceId]); // Re-load when study space changes

  // Auto-generate mind map when user clicks "Map" button
  React.useEffect(() => {
    const autoGenerateFromSelectedText = async () => {
      if (shouldAutoGenerate && selectedText && !currentMindMap && !generationInProgress.current && !hasAutoGenerated) {
        console.log('🚀 Starting auto-generation with selected text:', selectedText.text.substring(0, 50) + '...');
        setHasAutoGenerated(true);
        generationInProgress.current = true; // Set ref immediately to prevent interference
        setIsGenerating(true); // Set loading state immediately
        console.log('🔄 Generation state set - isGenerating: true, generationInProgress: true');
        
        // Set a default title based on the selected text
        const defaultTitle = `Mind Map: ${selectedText.text.substring(0, 30)}${selectedText.text.length > 30 ? '...' : ''}`;
        setMindMapTitle(defaultTitle);
        
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not authenticated');

          // Build context from selected text (prioritizing it)
          const studyContext = {
            selectedContent: [], // Don't use selected content when we have selected text
            selectedText: selectedText, // Selected text takes priority when available
            currentNotes: currentNotes || [], // Notes are always included as additional context
            title: defaultTitle
          };

          console.log('Sending mind map generation request...');
          const response = await fetch('/api/study-space/mind-map/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studyContext, baseClassId }),
          });

          if (!response.ok) {
            throw new Error('Failed to generate mind map');
          }

          const data = await response.json();
          console.log('✅ Mind map generation completed');
          
          if (data.mindMapData) {
            console.log('📊 Setting mind map data and clearing loading state');
            setCurrentMindMap(data.mindMapData);
            onMindMapCreated?.(data.mindMapData);
            // Clear loading state only after mind map is set
            setIsGenerating(false);
            generationInProgress.current = false;
          } else {
            console.error('❌ No mind map data received');
            setIsGenerating(false);
            generationInProgress.current = false;
          }
        } catch (error) {
          console.error('Error auto-generating mind map:', error);
          // Don't show alert for auto-generation, just log the error
          setIsGenerating(false); // Clear loading state on error
          generationInProgress.current = false;
        }
        // Don't use finally block - only clear loading state when we have a result or error
      }
    };

    // Add a small delay to prevent immediate execution during rapid state changes
    const timeoutId = setTimeout(autoGenerateFromSelectedText, 100);
    return () => clearTimeout(timeoutId);
  }, [shouldAutoGenerate, selectedText, currentMindMap, currentNotes, baseClassId, onMindMapCreated, hasAutoGenerated]); // Remove isGenerating from dependencies to prevent re-runs

  // Reset auto-generation flag when selectedText changes (but not when shouldAutoGenerate changes)
  React.useEffect(() => {
    setHasAutoGenerated(false);
  }, [selectedText]); // Remove shouldAutoGenerate from dependencies to prevent premature resets

  // Remove the immediate loading state useEffect - let the main auto-generation handle it

  const handleBack = () => {
    setCurrentMindMap(null);
    setHasAutoGenerated(false); // Allow auto-generation again if user selects new text
    generationInProgress.current = false; // Clear generation ref
  };

  const handleSave = async (mindMapData: MindMapData, title: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organisation_id) {
        throw new Error('No organisation found for user');
      }

      // Use the current study space or find/create a default one
      let studySpace;
      
      if (studySpaceId) {
        // Use the current study space
        studySpace = { id: studySpaceId };
      } else {
        // Find or create a default study space for the user
        let { data: defaultStudySpace, error: studySpaceError } = await supabase
          .from('study_spaces')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .single();

        if (studySpaceError || !defaultStudySpace) {
          // Create a default study space
          const { data: newStudySpace, error: createError } = await supabase
            .from('study_spaces')
            .insert({
              user_id: user.id,
              organisation_id: profile.organisation_id,
              name: 'My Study Space',
              description: 'Default study space for mind maps',
              is_default: true
            })
            .select('id')
            .single();

          if (createError) {
            console.error('Error creating study space:', createError);
            throw new Error('Failed to create study space');
          }
          studySpace = newStudySpace;
        } else {
          studySpace = defaultStudySpace;
        }
      }

      const { error } = await supabase
        .from('mind_maps')
        .insert({
          title,
          description: 'Saved from study space',
          map_data: mindMapData,
          user_id: user.id,
          organisation_id: profile.organisation_id,
          study_space_id: studySpace.id,
          is_shared: false,
          is_template: false
        });

      if (error) {
        console.error('Error saving mind map:', error);
        alert('Failed to save mind map. Please try again.');
      } else {
        alert('Mind map saved successfully!');
        loadSavedMindMaps(); // Reload the saved mind maps list
      }
    } catch (error) {
      console.error('Error saving mind map:', error);
      alert('Failed to save mind map. Please try again.');
    }
  };

  const loadMindMap = (mindMap: any) => {
    setCurrentMindMap(mindMap.map_data);
  };

  const generateMindMap = async () => {
    if (!selectedContent && !selectedText && !currentNotes?.length) {
      alert('Please select some content, text, or notes to generate a mind map from.');
      return;
    }

    // If we have selected text but no other sources, that's fine - selected text takes priority
    if (selectedText && !currentNotes?.length && (!selectedContent || selectedContent.length === 0)) {
      // This is valid - we have selected text which is sufficient
    }

    setIsGenerating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Build context from selected sources
      // If there's selected text, prioritize it over selected content
      const studyContext = {
        selectedContent: selectedText ? [] : (selectedContent || []), // Don't use selected content if we have selected text
        selectedText: selectedText || null, // Selected text takes priority when available
        currentNotes: currentNotes || [], // Notes are always included as additional context
        title: mindMapTitle || 'Study Mind Map'
      };

      const response = await fetch('/api/study-space/mind-map/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyContext, baseClassId }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate mind map');
      }

      const data = await response.json();
      
      if (data.mindMapData) {
        setCurrentMindMap(data.mindMapData);
      setIsCreateDialogOpen(false);
        setMindMapTitle('');
        
        // Save to database
        const { error } = await supabase
          .from('mind_maps')
          .insert({
            title: studyContext.title,
            content: selectedText?.text || 'Generated from study content',
            user_id: user.id,
            base_class_id: baseClassId,
            map_data: data.mindMapData
          });

        if (error) {
          console.error('Error saving mind map:', error);
        } else {
          onMindMapCreated?.(data.mindMapData);
        }
      }
    } catch (error) {
      console.error('Error generating mind map:', error);
      alert('Failed to generate mind map. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Always show mind map if we have one (highest priority)
  if (currentMindMap) {
    return (
      <MindMapDisplay
        content={JSON.stringify(currentMindMap)}
        metadata={{ studyContext: { selectedContent, selectedText, currentNotes } }}
        onMindMapUpdate={setCurrentMindMap}
        onBack={handleBack}
        onSave={handleSave}
      />
    );
  }

  // Show loading state when generating or about to generate (only if no mind map)
  // Make the loading state more persistent and robust
  const shouldShowLoading = (
    isGenerating || 
    generationInProgress.current ||
    (shouldAutoGenerate && selectedText && !hasAutoGenerated && !currentMindMap)
  );
  
  console.log('Loading check:', { 
    isGenerating, 
    generationInProgress: generationInProgress.current,
    shouldAutoGenerate, 
    hasAutoGenerated, 
    currentMindMap: !!currentMindMap,
    selectedText: !!selectedText,
    shouldShowLoading 
  });
  
  if (shouldShowLoading) {
    console.log('🔄 Showing loading state for mind map generation');
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <h3 className="text-lg font-semibold mb-2">Generating Mind Map</h3>
          <p className="text-muted-foreground text-center mb-4">
            Creating a mind map from your selected text: "{selectedText?.text.substring(0, 50)}..."
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <span>This may take a moment...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Mind Maps</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Mind Map
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generate Study Mind Map</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="mindMapTitle">Mind Map Title</Label>
                <Input
                  id="mindMapTitle"
                  placeholder="Enter a title for your mind map..."
                  value={mindMapTitle}
                  onChange={(e) => setMindMapTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Source Material</Label>
                <div className="text-sm text-muted-foreground space-y-1">
                  {selectedText ? (
                    // When there's selected text, prioritize it
                    <>
                      <div className="text-blue-600 dark:text-blue-400 font-medium">
                        • Primary: Text selection: "{selectedText.text.substring(0, 50)}..."
                      </div>
                      {currentNotes && currentNotes.length > 0 && (
                        <div>• Additional: {currentNotes.length} note(s) included</div>
                      )}
                      {selectedContent && selectedContent.length > 0 && (
                        <div className="text-slate-400 line-through">
                          • {selectedContent.length} content item(s) (will be ignored)
                        </div>
                      )}
                    </>
                  ) : (
                    // When no selected text, show normal sources
                    <>
                      {selectedContent && selectedContent.length > 0 && (
                        <div>• {selectedContent.length} content item(s) selected</div>
                      )}
                      {currentNotes && currentNotes.length > 0 && (
                        <div>• {currentNotes.length} note(s) included</div>
                      )}
                    </>
                  )}
                  {!selectedContent && !selectedText && !currentNotes?.length && (
                    <div className="text-amber-600">⚠️ No source material selected</div>
                  )}
              </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={generateMindMap} disabled={isGenerating}>
                {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Generate Mind Map
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Saved Mind Maps Section */}
      {savedMindMaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saved Mind Maps</CardTitle>
            <p className="text-sm text-muted-foreground">
              Load a previously saved mind map
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedMindMaps.map((mindMap) => (
                <div
                  key={mindMap.id}
                  className="border rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  onClick={() => loadMindMap(mindMap)}
                >
                  <h4 className="font-medium mb-2">{mindMap.title}</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {mindMap.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(mindMap.created_at).toLocaleDateString()}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {mindMap.map_data?.branches?.length || 0} branches
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
          <Eye className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No mind map generated yet</h3>
            <p className="text-muted-foreground text-center mb-4">
            Highlight specific text for focused mind maps, or select content sources for broader coverage. Selected text takes priority when available.
            </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
                Generate First Mind Map
              </Button>
              </CardContent>
            </Card>
    </div>
  );
} 