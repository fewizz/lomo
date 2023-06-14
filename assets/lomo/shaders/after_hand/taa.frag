#include frex:shaders/api/world.glsl

uniform ivec2 frxu_size;

uniform sampler2D u_color;
uniform sampler2D u_depth;
uniform sampler2D u_solid_depth;
uniform sampler2D u_previous_taa;
uniform sampler2D u_previous_taa_depth;

layout(location = 0) out vec4 out_color;
layout(location = 1) out float out_depth;

void main() {
	float depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).x;
	bool hand = false;
	{
		float solid_depth = texelFetch(u_solid_depth, ivec2(gl_FragCoord.xy), 0).x;
		if(solid_depth < depth) {
			hand = true;
			depth = solid_depth;
		}
	}
	vec3 color = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	color = pow(color, vec3(2.2));

	vec3 ndc = vec3(gl_FragCoord.xy, depth) / vec3(frxu_size, 1.0) * 2.0 - 1.0;
	vec4 world0 = frx_inverseViewProjectionMatrix * vec4(ndc, 1.0);
	vec3 world = world0.xyz / world0.w;

	if(!hand) {
		world += frx_cameraPos;
		world -= frx_lastCameraPos;
		vec4 ndc0 = frx_lastViewProjectionMatrix * vec4(world, 1.0);
		ndc = ndc0.xyz / ndc0.w;
	}

	if(any(greaterThanEqual(abs(ndc.xy), vec2(1.0)))) {
		out_color = vec4(color, 1.0);
		return;
	}

	vec2 prev_window_space_pos = (ndc.xy * 0.5 + 0.5) * vec2(frxu_size);

	vec3 prev_color = texture(u_previous_taa, prev_window_space_pos / vec2(frxu_size)).rgb;
	float prev_depth = texture(u_previous_taa_depth, prev_window_space_pos / vec2(frxu_size)).r;

	vec3 mn = vec3(1024.0);
	vec3 mx = vec3(0.0);

	for(int x = -1; x <= 1; ++x) {
		for(int y = -1; y <= 1; ++y) {
			vec2 off = vec2(x, y);
			off = off != vec2(0.0) ? normalize(off) : off;
			vec3 c = texture(u_color, (gl_FragCoord.xy + off) / vec2(frxu_size)).rgb;
			c = pow(c, vec3(2.2));
			mn = min(c, mn);
			mx = max(c, mx);
		}
	}

	out_color = vec4(
		clamp(mix(prev_color, color, 1.0 / 4.0), mn, mx),
		1.0
	);
	out_depth = mix(prev_depth, depth, 1.0 / 4.0);
}