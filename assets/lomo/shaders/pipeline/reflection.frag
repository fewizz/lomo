#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/traverser.glsl
#include lomo:shaders/pipeline/post/compute_normal.glsl

/* lomo:pipeline/reflection.frag */

uniform sampler2D u_color;
uniform sampler2D u_normal;
uniform sampler2D u_extra_0;
uniform sampler2D u_extra_1;
uniform sampler2D u_depth;
uniform sampler2D u_win_normal;
uniform sampler2D u_hi_depth;

layout(location = 0) out vec4 out_reflection_position;

void main() {
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	vec3 pos_win_0 = vec3(gl_FragCoord.xy, depth_0);
	vec3 pos_cam_0 = win_to_cam(pos_win_0);

	vec3 normal_cam_raw_0 = texelFetch(u_normal, ivec2(gl_FragCoord.xy), 0).xyz;
	if(dot(normal_cam_raw_0, normal_cam_raw_0) < 0.9) {
		out_reflection_position = vec4(pos_win_0, TRAVERSAL_OUT_OF_FB);
		return;
	}
	vec3 normal_cam_0 = normalize(normal_cam_raw_0);
	vec3 dir_inc_cam_0 = cam_dir_to_z1(gl_FragCoord.xy);

	vec3 extras_0_0 = texelFetch(u_extra_0, ivec2(gl_FragCoord.xy), 0).xyz;
	float roughness_0 = extras_0_0[0];

	vec3 normal_cam_transformed_0 = compute_normal(
		dir_inc_cam_0, normal_cam_0, uvec2(gl_FragCoord.xy), roughness_0, 0
	);
	vec3 dir_out_cam_0 = reflect(dir_inc_cam_0, normal_cam_transformed_0);

	vec3 pos_win_traverse_beginning = pos_win_0;
	pos_win_traverse_beginning.z -= pos_win_traverse_beginning.z / 10000.0;
	uint max_side = uint(max(frxu_size.x, frxu_size.y));
	fb_traversal_result result = traverse_fb(
		pos_win_traverse_beginning, pos_cam_0, dir_out_cam_0,
		u_hi_depth, u_depth, u_win_normal,
		uint(max_side / 30)
	);

	vec3 resulting_pos_win = vec3(
		result.pos.texel + result.pos.inner, result.pos.z
	);

	out_reflection_position = vec4(win_to_cam(resulting_pos_win), result.code);
}