import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface ClassInstance {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  updated_at: string;
}

interface ClassInstanceAnalysis extends ClassInstance {
  shouldBe: string;
  needsUpdate: boolean;
}

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const today = new Date().toISOString().split('T')[0];
    let totalUpdated = 0;
    
    // Get all class instances that might need status updates
    const { data: instances, error: fetchError } = await supabase
      .from('class_instances')
      .select('id, status, start_date, end_date');

    if (fetchError) {
      console.error('Error fetching class instances:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch class instances' },
        { status: 500 }
      );
    }

    // Update instances to 'active' if start_date has passed and not already completed
    const toActivate = instances?.filter(instance => 
      instance.start_date && 
      instance.start_date <= today && 
      instance.status !== 'completed' && 
      instance.status !== 'active'
    ) || [];

    if (toActivate.length > 0) {
      const { error: activateError } = await supabase
        .from('class_instances')
        .update({ 
          status: 'active', 
          updated_at: new Date().toISOString() 
        })
        .in('id', toActivate.map(i => i.id));

      if (activateError) {
        console.error('Error activating instances:', activateError);
      } else {
        totalUpdated += toActivate.length;
      }
    }

    // Update instances to 'completed' if end_date has passed
    const toComplete = instances?.filter(instance => 
      instance.end_date && 
      instance.end_date < today && 
      instance.status !== 'completed'
    ) || [];

    if (toComplete.length > 0) {
      const { error: completeError } = await supabase
        .from('class_instances')
        .update({ 
          status: 'completed', 
          updated_at: new Date().toISOString() 
        })
        .in('id', toComplete.map(i => i.id));

      if (completeError) {
        console.error('Error completing instances:', completeError);
      } else {
        totalUpdated += toComplete.length;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updated_count: totalUpdated,
        timestamp: new Date().toISOString(),
        message: 'Class instance statuses updated successfully',
        details: {
          activated: toActivate.length,
          completed: toComplete.length
        }
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for checking current status without updates
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get current class instances with their status analysis
    const { data, error } = await supabase
      .from('class_instances')
      .select(`
        id,
        name,
        start_date,
        end_date,
        status,
        updated_at
      `)
      .order('start_date');

    if (error) {
      console.error('Error fetching class instances:', error);
      return NextResponse.json(
        { error: 'Failed to fetch class instances' },
        { status: 500 }
      );
    }

    // Analyze which ones might need status updates
    const analysis: ClassInstanceAnalysis[] = (data as ClassInstance[])?.map((instance: ClassInstance) => {
      let shouldBe = instance.status || 'upcoming';
      const today = new Date().toISOString().split('T')[0];
      
      if (instance.end_date && instance.end_date < today) {
        shouldBe = 'completed';
      } else if (instance.start_date && instance.start_date <= today) {
        shouldBe = 'active';
      } else if (instance.start_date && instance.start_date > today) {
        shouldBe = 'upcoming';
      }
      
      return {
        ...instance,
        shouldBe,
        needsUpdate: shouldBe !== instance.status
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: analysis,
      summary: {
        total: analysis.length,
        needingUpdate: analysis.filter((i: ClassInstanceAnalysis) => i.needsUpdate).length,
        byStatus: {
          active: analysis.filter((i: ClassInstanceAnalysis) => i.status === 'active').length,
          upcoming: analysis.filter((i: ClassInstanceAnalysis) => i.status === 'upcoming').length,
          completed: analysis.filter((i: ClassInstanceAnalysis) => i.status === 'completed').length,
        }
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 