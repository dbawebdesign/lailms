/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST as podcast } from '../src/app/api/teach/media/generate/podcast/route';
import { POST as mindmap } from '../src/app/api/teach/media/generate/mind-map/route';
import { createSupabaseServerClient } from '../src/lib/supabase/server';
import { brainbytesGenerationService } from '../src/lib/services/brainbytes-generation-service';
import { mindMapGenerationService } from '../src/lib/services/mind-map-generation-service';
jest.mock('../src/lib/supabase/server',()=>({createSupabaseServerClient:jest.fn()}));
jest.mock('../src/lib/services/brainbytes-generation-service',()=>({brainbytesGenerationService:{generateLessonBrainbytes:jest.fn()}}));
jest.mock('../src/lib/services/mind-map-generation-service',()=>({mindMapGenerationService:{generateLessonMindMap:jest.fn(),generateBaseClassMindMap:jest.fn()}}));
const request=()=>new NextRequest('http://localhost/api/generate',{method:'POST',body:JSON.stringify({lessonId:'lesson',internal:true,userId:'victim'})});
beforeEach(()=>jest.clearAllMocks());
it.each([podcast,mindmap])('rejects a forged internal request before generating anything',async handler=>{
  (createSupabaseServerClient as jest.Mock).mockReturnValue({auth:{getUser:async()=>({data:{user:null},error:null})}});
  expect((await handler(request())).status).toBe(401);
  expect(brainbytesGenerationService.generateLessonBrainbytes).not.toHaveBeenCalled();
  expect(mindMapGenerationService.generateLessonMindMap).not.toHaveBeenCalled();
});
it('keeps authenticated generation and forces the ordinary authorization path',async()=>{
  const client={auth:{getUser:async()=>({data:{user:{id:'real-user'}},error:null})}};
  (createSupabaseServerClient as jest.Mock).mockReturnValue(client);
  (brainbytesGenerationService.generateLessonBrainbytes as jest.Mock).mockResolvedValue({success:true,asset:{id:'asset'}});
  (mindMapGenerationService.generateLessonMindMap as jest.Mock).mockResolvedValue({success:true,asset:{id:'asset'}});
  expect((await podcast(request())).status).toBe(200);
  expect((await mindmap(request())).status).toBe(200);
  for(const generate of [brainbytesGenerationService.generateLessonBrainbytes,mindMapGenerationService.generateLessonMindMap]) {
    expect(generate).toHaveBeenCalledWith(client,'lesson',{id:'real-user'},expect.objectContaining({internal:false}));
  }
});
