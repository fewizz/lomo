#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl
#include lomo:shaders/lib/transform.glsl
#include lomo:general

uniform sampler2DArray u_prev_taa;
uniform sampler2D u_light;
uniform sampler2D u_depth;

layout(location = 0) out vec4 out_taa[4];
layout(location = 4) out vec3 out_light;

void main() {
	vec3 color = texelFetch(u_light, ivec2(gl_FragCoord.xy), 0).rgb;

#ifndef TAA
	out_light = color;
#else

	int current = int(frx_renderFrames % 4u);
	float win_depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;

	vec2 cur_pos_uv = (gl_FragCoord.xy) / frxu_size.xy;

	vec3 cur_pos_ndc = vec3(cur_pos_uv, win_depth) * 2.0 - 1.0;

	vec4 cur_pos_world0 = frx_inverseViewProjectionMatrix * vec4(cur_pos_ndc, 1.0);
	vec3 cur_pos_world = cur_pos_world0.xyz / cur_pos_world0.w;

	cur_pos_world += frx_cameraPos;
	cur_pos_world -= frx_lastCameraPos;

	vec4 prev_pos_ndc0 = frx_lastViewProjectionMatrix * vec4(cur_pos_world, 1.0);
	vec3 prev_pos_ndc = prev_pos_ndc0.xyz / prev_pos_ndc0.w;

	vec3 prev_pos_win = (prev_pos_ndc * 0.5 + 0.5) * vec3(frxu_size.xy, 1.0);

	vec2 uv = prev_pos_ndc.xy * 0.5 + 0.5;

	vec4 colors[4];
	for(int i = 0; i < 4; ++i) {
		colors[i] =
			//texelFetch(u_prev_taa, ivec3(prev_pos_win.xy, i), 0);
			texture(u_prev_taa, vec3(uv, float(i)));
	}

	//float depth = linearize_depth(win_depth);
	//vec4 depths = texture(u_taa_depth, uv);

	if(any(greaterThan(abs(prev_pos_ndc.xy), vec2(1.0)))) {
		for(int i = 0; i < 4; ++i) colors[i].w = 0.0;
	}
	else {
		//for(int i = 0; i < 4; ++i) {
		float w = 0.0;
		
		for(int x = -1; x <= 1; ++x) {
			for(int y = -1; y <= 1; ++y) {
				vec3 color0 = texelFetch(u_light, ivec2(gl_FragCoord.xy) + ivec2(x, y), 0).rgb;
				float d = distance(color0, colors[current].rgb);
				float w0 = exp(-(d * 64.0));
				w = max(w, w0);
			}	
		}

		for(uint i = 0u; i < 4u; ++i) {
			uint ind = (frx_renderFrames + i) % 4u;
			colors[ind].w *= mix(w, 1.0, pow(i / 4.0, 8.0));
		}
	}

	colors[current] = vec4(color, 1.0);

	for(int i = 0; i < 4; ++i) {
		out_taa[i] = colors[i];
	}

	vec3 resulting_color = vec3(0.0);
	float total_weight = 0.0;
	for(int i = 0; i < 4; ++i) {
		float weight = colors[i].w;
		resulting_color += colors[i].rgb * weight;
		total_weight += weight;
	}
	resulting_color /= total_weight;

	out_light = resulting_color;
#endif
}