#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:shaders/depth_levels.frag */

uniform sampler2D u_depth;

varying vec2 _cvv_texcoord;

void main() {
	int lod_from = frxu_lod - 1;
	//if(frxu_lod == 1) lod_from = 0;
	//else lod_from = frxu_lod - 1;

	float mn = 1;
	int mul = int( pow(2, lod_from) );

	//ivec2 size = textureSize(u_depth, lod_from);

	for(int x = 0; x < 4; x++) {
		for(int y = 0; y < 4; y++) {
			ivec2 v = ivec2(gl_FragCoord.xy)*4 + ivec2(x, y);

			if(v.x * mul >= frxu_size.x || v.y * mul >= frxu_size.y) continue;

			float d = texelFetch(u_depth, v, lod_from).r;
			mn = min(mn, d);
		}
	}

	/*vec4 fetches = vec4(
		texelFetch(u_depth, ivec2(gl_FragCoord.xy)*2+ivec2(0, 0), lod_from).r,
		texelFetch(u_depth, ivec2(gl_FragCoord.xy)*2+ivec2(0, 1), lod_from).r,
		texelFetch(u_depth, ivec2(gl_FragCoord.xy)*2+ivec2(1, 0), lod_from).r,
		texelFetch(u_depth, ivec2(gl_FragCoord.xy)*2+ivec2(1, 1), lod_from).r
	);*/

	gl_FragData[0] = vec4(/*min(min(fetches[0], fetches[1]), min(fetches[2], fetches[3]))*/mn, 0, 0, 1);
}