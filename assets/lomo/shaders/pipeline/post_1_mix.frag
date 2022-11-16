#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/ratio.glsl

uniform sampler2D u_post_1;
uniform sampler2D u_prev_post_1;
uniform sampler2D u_extra_0;

uniform sampler2D u_depth;
uniform sampler2D u_prev_depth;

layout(location = 0) out vec4 out_post_1_mixed;

void main() {
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	vec3 pos_win_0 = vec3(gl_FragCoord.xy, depth_0);
	vec3 pos_cam_0 = win_to_cam(pos_win_0);
	vec4 extras_0 = texelFetch(u_extra_0, ivec2(gl_FragCoord.xy), 0);
	float roughness_0 = extras_0[0];
	vec3 dir_inc_cam_0 = cam_dir_to_z1(pos_win_0.xy);

	dvec3 r_prev_pos_cam = dvec3(pos_cam_0);
	dvec3 r_prev_pos_wrd = cam_to_wrd(r_prev_pos_cam);
	r_prev_pos_wrd += dvec3(frx_cameraPos) - dvec3(frx_lastCameraPos);

	r_prev_pos_cam = transform_pos(
		r_prev_pos_wrd, dmat4(frx_lastViewMatrix)
	);
	dvec3 r_prev_pos_ndc = transform_pos(
		r_prev_pos_cam, dmat4(frx_lastProjectionMatrix)
	);
	dvec3 r_prev_pos_win = ndc_to_win(r_prev_pos_ndc);

	float prev_depth = texelFetch(u_prev_depth, ivec2(r_prev_pos_win.xy), 0).r;

	vec3 post_1 = texelFetch(u_post_1, ivec2(gl_FragCoord.xy), 0).rgb;
	post_1 = max(post_1, vec3(0.0));
	post_1 = pow(post_1, vec3(2.2));

	vec3 prev_post_1 =
		//texelFetch(u_prev_post_1, ivec2(r_prev_pos_win.xy), 0).rgb;
		texture(u_prev_post_1, vec2(r_prev_pos_ndc.xy) * 0.5 + 0.5).rgb;
	prev_post_1 = max(prev_post_1, vec3(0.0));
	prev_post_1 = pow(prev_post_1, vec3(2.2));

	float ratio = texelFetch(u_prev_post_1, ivec2(r_prev_pos_win.xy), 0).w;
	ratio = max(ratio, 0.0);

	if(
		any(greaterThan(vec3(r_prev_pos_ndc), vec3( 1.0))) ||
		any(lessThan   (vec3(r_prev_pos_ndc), vec3(-1.0)))
	) {
		ratio = 0.0;
	}
	else {
		double diff = abs(prev_depth - r_prev_pos_win.z);
		ratio *= max(0.0, exp(-float(diff * 1024.0)));

		vec3 prev_dir_inc_cam = cam_dir_to_z1(vec2(r_prev_pos_win.xy));
		prev_dir_inc_cam = mat3(frx_viewMatrix) * (inverse(mat3(frx_lastViewMatrix)) * prev_dir_inc_cam);

		float sn = length(cross(dir_inc_cam_0, prev_dir_inc_cam));
		float a = asin(sn);
		ratio *= pow(roughness_0, a);
	}

	float actual_ratio = ratio;

	vec3 mixed = mix(post_1, prev_post_1, actual_ratio);
	mixed = pow(mixed, vec3(1.0 / 2.2));

	ratio = increase_ratio(ratio, 16.0 * roughness_0);
	out_post_1_mixed = vec4(mixed, ratio);
}