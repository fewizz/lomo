#include frex:shaders/api/world.glsl

uniform ivec2 frxu_size;

uniform sampler2D u_color;
uniform sampler2D u_depth;
uniform sampler2D u_previous_taa;

layout(location = 0) out vec4 out_color;

void main() {
	float depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).x;
	vec3 ndc = vec3(gl_FragCoord.xy, depth) / vec3(frxu_size.xy, 1.0) * 2.0 - 1.0;
	vec4 world0 = frx_inverseViewProjectionMatrix * vec4(ndc, 1.0);
	vec3 world = world0.xyz / world0.w;

	world += frx_cameraPos;
	// going backwards
	world -= frx_lastCameraPos;

	vec4 ndc0 = frx_lastViewProjectionMatrix * vec4(world, 1.0);
	ndc = ndc0.xyz / ndc0.w;

	//vec2 prev_window_space_pos = (ndc.xy * 0.5 + 0.5) * vec2(frxu_size.xy);

	vec3 prev = texture(u_previous_taa, ndc.xy * 0.5 + 0.5).rgb;
	vec3 curr = texelFetch(u_color, ivec2(gl_FragCoord.xy), 0).rgb;
	out_color = vec4(mix(prev, curr, 0.1), 1.0);
}