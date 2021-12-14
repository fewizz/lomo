#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl
#include lomo:shaders/lib/transform.glsl

/* lomo:normals_from_depth.frag */

uniform sampler2D u_depth;

layout(location = 0) out vec4 out_normal;

void main() {
	float depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;

	vec3 pos_cam = win_to_cam(vec3(gl_FragCoord.xy, depth));

	vec2 pos_win = gl_FragCoord.xy;
	vec2 uv = gl_FragCoord.xy / vec2(frxu_size);
	vec2 n = uv * 2 - 1;

	vec3 x = win_to_cam(
		vec3(
			gl_FragCoord.xy + vec2(-sign(n.x), 0.),
			texelFetch(u_depth, ivec2(gl_FragCoord.xy + vec2(-sign(n.x), 0.)), 0).r
		)
	);

	vec3 y = win_to_cam(
		vec3(
			gl_FragCoord.xy + vec2(0., -sign(n.y)),
			texelFetch(u_depth, ivec2(gl_FragCoord.xy + vec2(0., -sign(n.y))), 0).r
		)
	);

	vec3 normal = normalize(cross(
		x - pos_cam,
		y - pos_cam
	));

	normal *= sign(n.x) * sign(n.y);

	out_normal = vec4(normal, 1.0);
}