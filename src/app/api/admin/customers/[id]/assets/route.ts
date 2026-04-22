import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabase = await createSupabaseServerClient();

    // Check if admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc('is_admin', {
      user_uuid: user.id,
    } as any);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const assetType = formData.get('assetType') as string;
    const assetId = formData.get('assetId') as string | null;

    if (!file || !assetType) {
      return NextResponse.json({ error: 'Missing file or asset type' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${assetType}/${Date.now()}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated-assets')
      .upload(fileName, file, {
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('generated-assets')
      .getPublicUrl(fileName);

    // Update or insert asset record
    if (assetId) {
      // Update existing asset
      const updateData = {
        storage_url: publicUrl,
        status: 'ready',
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('aa_demo_generated_assets')
        .update(updateData as unknown as never)
        .eq('id', assetId);

      if (updateError) {
        console.error('Update error:', updateError);
        return NextResponse.json({ error: 'Failed to update asset record' }, { status: 500 });
      }
    } else {
      // Create new asset record
      const { error: insertError } = await supabase
        .from('aa_demo_generated_assets')
        .insert({
          user_id: userId,
          asset_type: assetType,
          storage_url: publicUrl,
          status: 'ready',
          metadata: { uploaded_by_admin: true },
        } as any);

      if (insertError) {
        console.error('Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to create asset record' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      message: 'Asset uploaded successfully' 
    });
  } catch (error) {
    console.error('Asset upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
