#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/pipeline.glsl
#include lomo:shaders/lib/transform.glsl

/* lomo:normals_from_depth.frag */

uniform sampler2D u_depth;

layout(location = 0) out vec4 out_normal;

void main() {
	float depth = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;

	vec3 pos_cam = win_to_cam(vec3(gl_FragCoord.xy, depth));

	out_normal = vec4(normalize(cross(
		win_to_cam(
			vec3(
				gl_FragCoord.xy + vec2(1., 0.),
				texelFetch(u_depth, ivec2(gl_FragCoord.xy + vec2(1., 0.)), 0).r
			)
		) - pos_cam,
		win_to_cam(
			vec3(
				gl_FragCoord.xy + vec2(0., 1.),
				texelFetch(u_depth, ivec2(gl_FragCoord.xy + vec2(0., 1.)), 0).r
			)
		) - pos_cam
	)), 1.0);
}