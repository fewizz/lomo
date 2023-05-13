#include lomo:shaders/sky.glsl

uniform sampler2D u_blended_color;
uniform sampler2D u_blended_normal;
uniform sampler2D u_blended_data;
uniform sampler2D u_blended_depth;

uniform samplerCube u_skybox;

layout(location = 0) out vec4 out_color;

void main() {
	vec3 color = texelFetch(u_blended_color, ivec2(gl_FragCoord.xy), 0).rgb;
	vec3 normal = texelFetch(u_blended_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	vec3 data = texelFetch(u_blended_data, ivec2(gl_FragCoord.xy), 0).xyz;
	float depth = texelFetch(u_blended_depth, ivec2(gl_FragCoord.xy), 0).x;

	vec3 dir; {
		vec3 ndc_near = vec3(gl_FragCoord.xy, 0.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;
		vec3 ndc_far  = vec3(gl_FragCoord.xy, 1.0) / vec3(frx_viewWidth, frx_viewHeight, 1.0) * 2.0 - 1.0;

		vec4 world_near0 = frx_inverseViewProjectionMatrix * vec4(ndc_near, 1.0);
		vec4 world_far0  = frx_inverseViewProjectionMatrix * vec4(ndc_far, 1.0);
		vec3 world_near = world_near0.xyz / world_near0.w;
		vec3 world_far  = world_far0.xyz  / world_far0.w;

		dir = normalize(world_far - world_near);
	}

	if(data.z < 0.1) {
		vec3 n = mat3(frx_inverseViewMatrix) * normal;
		vec3 reflect_dir = reflect(dir, n);
		vec3 sky_color = sky(reflect_dir);
		color = mix(sky_color, color, max(0.0, dot(reflect_dir, n)));
	}

	if(depth == 1.0) {
		color = sky(dir);
	}

	out_color = vec4(color, 1.0);
}