#include frex:shaders/api/header.glsl

#include lomo:shaders/lib/transform.glsl

#include lomo:shaders/pipeline/post/ratio.glsl

uniform sampler2D u_post_1;
uniform sampler2D u_prev_post_1;
uniform sampler2D u_ratio;
uniform sampler2D u_extra_0;
uniform sampler2D u_depth;

layout(location = 0) out vec3 out_post_1_mixed;

void main() {
	float depth_0 = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r;
	vec3 pos_win_0 = vec3(gl_FragCoord.xy, depth_0);
	vec3 pos_cam_0 = win_to_cam(pos_win_0);
	vec4 extras_0 = texelFetch(u_extra_0, ivec2(gl_FragCoord.xy), 0);
	float roughness_0 = clamp(extras_0[0], 0.0, 1.0);

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

	vec3 post_1 = texelFetch(u_post_1, ivec2(gl_FragCoord.xy), 0).rgb;
	post_1 = max(post_1, vec3(0.0));
	post_1 = pow(post_1, vec3(2.2));

	vec3 prev_post_1 =
		//texelFetch(u_prev_post_1, ivec2(r_prev_pos_win.xy), 0).rgb;
		texture(u_prev_post_1, vec2(r_prev_pos_ndc.xy) * 0.5 + 0.5).rgb;
	prev_post_1 = max(prev_post_1, vec3(0.0));
	prev_post_1 = pow(prev_post_1, vec3(2.2));

	float ratio = texelFetch(u_ratio, ivec2(gl_FragCoord.xy), 0).r;

	vec3 mixed = mix(post_1, prev_post_1, ratio);
	mixed = pow(mixed, vec3(1.0 / 2.2));

	out_post_1_mixed = vec3(mixed);
}